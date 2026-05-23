import { supabase } from '@coaching/sdk';
import { getLibraryByCoach } from '@coaching/tools';
import { fetchYoutubeCaptions, extractVideoIdFromUrl } from '@coaching/tools';
import { transcribeFile, transcribeYoutubeAudio } from '@coaching/tools';
import { upsertLibraryItem, extractPdfText, extractWordText, isWordDocument } from '@coaching/tools';

// In-memory queue: one active transcription job per coach to avoid server overload
const _activeJobs = new Set<string>();

/**
 * Transcribes a single library item and stores the result.
 * For youtube: tries captions API first, falls back to yt-dlp + Whisper.
 * For pdf/audio/video uploaded files: downloads and runs Whisper.
 * On completion: stores transcript on coach_library_items, chunks into Pinecone,
 * and marks library_item.embedded_at.
 */
export async function transcribeLibraryItem(
  coachId: string,
  itemId: string
): Promise<{ source: string; charCount: number }> {
  const { data: item, error } = await supabase
    .from('coach_library_items')
    .select('*')
    .eq('item_id', itemId)
    .single();
  if (error || !item) throw new Error(`Library item not found: ${itemId}`);

  const itemType: string = item.item_type;
  let transcript = '';
  let source: 'youtube_captions' | 'whisper' | 'text-extraction' = 'whisper';

  console.log(`[transcription] starting item ${itemId} (type=${itemType}, title="${item.title}")`);

  if (itemType === 'youtube') {
    const videoId = extractVideoIdFromUrl(item.url as string);
    console.log(`[transcription] youtube — videoId=${videoId}, trying captions API first`);

    // Fast path: YouTube captions
    const captions = await fetchYoutubeCaptions(videoId);
    if (captions) {
      console.log(`[transcription] captions found (${captions.length} chars), skipping Whisper`);
      transcript = captions;
      source = 'youtube_captions';
    } else {
      console.log(`[transcription] no captions — downloading audio with yt-dlp then running Whisper`);
      transcript = await transcribeYoutubeAudio(item.url as string);
      console.log(`[transcription] Whisper done (${transcript.length} chars)`);
      source = 'whisper';
    }
  } else if (itemType === 'pdf') {
    const fileUrl = item.url as string;
    if (!fileUrl) throw new Error(`PDF item ${itemId} has no URL`);
    if (isWordDocument(fileUrl)) {
      console.log(`[transcription] pdf (Word file) — extracting text with mammoth`);
      try {
        transcript = await extractWordText(fileUrl);
        console.log(`[transcription] Word extraction succeeded (${transcript.length} chars)`);
        source = 'text-extraction';
      } catch {
        console.warn(`[transcription] Word extraction failed for ${itemId}, falling back to title+description`);
        transcript = [item.title, item.description].filter(Boolean).join('\n\n');
        source = 'text-extraction';
      }
    } else {
      console.log(`[transcription] pdf — trying direct text extraction`);
      try {
        transcript = await extractPdfText(fileUrl);
        console.log(`[transcription] pdf text extraction succeeded (${transcript.length} chars)`);
        source = 'text-extraction';
      } catch {
        console.warn(`[transcription] PDF text extraction failed for ${itemId}, falling back to Whisper`);
        const tmpPath = await downloadToTemp(fileUrl);
        transcript = await transcribeFile(tmpPath);
        console.log(`[transcription] Whisper done (${transcript.length} chars)`);
        source = 'whisper';
      }
    }
  } else if (itemType === 'podcast') {
    console.log(`[transcription] podcast — downloading audio then running Whisper`);
    const fileUrl = item.url as string;
    const tmpPath = await downloadToTemp(fileUrl);
    transcript = await transcribeFile(tmpPath);
    console.log(`[transcription] Whisper done (${transcript.length} chars)`);
    source = 'whisper';
  } else if (itemType === 'book' && item.url) {
    const fileUrl = item.url as string;
    if (isWordDocument(fileUrl)) {
      console.log(`[transcription] book (Word file) — extracting text with mammoth`);
      try {
        transcript = await extractWordText(fileUrl);
        console.log(`[transcription] Word extraction succeeded (${transcript.length} chars)`);
        source = 'text-extraction';
      } catch {
        console.warn(`[transcription] Word extraction failed for book ${itemId}, using title+description`);
        transcript = [item.title, item.description].filter(Boolean).join('\n\n');
        source = 'text-extraction';
      }
    } else {
      console.log(`[transcription] book — trying PDF text extraction`);
      try {
        transcript = await extractPdfText(fileUrl);
        console.log(`[transcription] book pdf extraction succeeded (${transcript.length} chars)`);
        source = 'text-extraction';
      } catch {
        console.warn(`[transcription] PDF extraction failed for book ${itemId}, using title+description`);
        transcript = [item.title, item.description].filter(Boolean).join('\n\n');
        source = 'text-extraction';
      }
    }
  } else {
    console.log(`[transcription] ${itemType} — using title+description as text`);
    transcript = [item.title, item.description].filter(Boolean).join('\n\n');
    source = 'text-extraction';
  }

  if (!transcript.trim()) {
    throw new Error(`No transcript content produced for item ${itemId}`);
  }

  console.log(`[transcription] saving transcript to DB (source=${source}, chars=${transcript.length})`);
  await supabase.from('coach_library_items').update({
    transcript,
    transcript_source:   source,
    transcript_language: 'en',
    chunks_indexed:      false,
  }).eq('item_id', itemId);

  console.log(`[transcription] embedding chunks into Pinecone`);
  await upsertLibraryItem(coachId, itemId, transcript, {
    itemId,
    coachId,
    title:    item.title as string,
    itemType,
  });

  console.log(`[transcription] marking item as indexed`);
  await supabase.from('coach_library_items')
    .update({ chunks_indexed: true, embedded_at: new Date().toISOString() })
    .eq('item_id', itemId);

  return { source, charCount: transcript.length };
}

/**
 * Processes all unembedded library items for a coach, one at a time.
 * Skips items already in progress for this coach to prevent duplicate jobs.
 */
export async function transcribeAllPending(coachId: string): Promise<{ processed: number; failed: number }> {
  if (_activeJobs.has(coachId)) return { processed: 0, failed: 0 };
  _activeJobs.add(coachId);

  let processed = 0, failed = 0;
  try {
    const { data: pending } = await supabase
      .from('coach_library_items')
      .select('item_id, item_type')
      .eq('coach_id', coachId)
      .is('embedded_at', null)
      .in('item_type', ['youtube', 'pdf', 'podcast', 'book', 'article', 'note']);

    for (const item of pending ?? []) {
      try {
        await transcribeLibraryItem(coachId, item.item_id as string);
        processed++;
      } catch (err) {
        // Log but continue with next item
        console.error(`[transcription] Failed for item ${item.item_id}:`, (err as Error).message);
        failed++;
      }
    }
  } finally {
    _activeJobs.delete(coachId);
  }
  return { processed, failed };
}

/**
 * Transcribes all unembedded library items of specific types for a coach.
 * Useful for targeted RAG indexing (e.g. only books+PDFs, or only videos).
 */
export async function transcribeByType(
  coachId: string,
  types: string[]
): Promise<{ processed: number; failed: number }> {
  const jobKey = `${coachId}:${types.sort().join(',')}`;
  if (_activeJobs.has(jobKey)) return { processed: 0, failed: 0 };
  _activeJobs.add(jobKey);

  let processed = 0, failed = 0;
  try {
    const { data: pending } = await supabase
      .from('coach_library_items')
      .select('item_id, item_type')
      .eq('coach_id', coachId)
      .is('embedded_at', null)
      .in('item_type', types);

    for (const item of pending ?? []) {
      try {
        await transcribeLibraryItem(coachId, item.item_id as string);
        processed++;
      } catch (err) {
        console.error(`[transcription] Failed for item ${item.item_id}:`, (err as Error).message);
        failed++;
      }
    }
  } finally {
    _activeJobs.delete(jobKey);
  }
  return { processed, failed };
}

/**
 * Saves a manually-entered transcript and immediately embeds it into Pinecone.
 * Sets transcript_source = 'manual' so it does not count toward whisper minutes.
 */
export async function embedManualTranscript(
  coachId: string,
  itemId: string,
  transcript: string
): Promise<{ charCount: number }> {
  if (!transcript.trim()) throw new Error('Transcript is empty');

  const { data: item, error } = await supabase
    .from('coach_library_items')
    .select('title, item_type')
    .eq('item_id', itemId)
    .single();
  if (error || !item) throw new Error(`Library item not found: ${itemId}`);

  console.log(`[transcription] saving manual transcript for item ${itemId} (${item.title})`);
  const { error: saveErr } = await supabase.from('coach_library_items').update({
    transcript,
    transcript_source:   'manual',
    transcript_language: 'en',
    chunks_indexed:      false,
    embedded_at:         null,
  }).eq('item_id', itemId).eq('coach_id', coachId);
  if (saveErr) throw new Error(`Failed to save transcript to DB: ${saveErr.message}`);

  console.log(`[transcription] embedding manual transcript into Pinecone`);
  await upsertLibraryItem(coachId, itemId, transcript, {
    itemId,
    coachId,
    title:    item.title as string,
    itemType: item.item_type as string,
  });

  const { error: markErr } = await supabase.from('coach_library_items')
    .update({ chunks_indexed: true, embedded_at: new Date().toISOString() })
    .eq('item_id', itemId).eq('coach_id', coachId);
  if (markErr) throw new Error(`Failed to mark item as indexed: ${markErr.message}`);

  console.log(`[transcription] manual transcript indexed (${transcript.length} chars)`);
  return { charCount: transcript.length };
}

/**
 * Returns the stored transcript for a library item, or null if not yet transcribed.
 */
export async function getTranscript(libraryItemId: string): Promise<string | null> {
  const { data } = await supabase
    .from('coach_library_items')
    .select('transcript')
    .eq('item_id', libraryItemId)
    .maybeSingle();
  return data?.transcript ?? null;
}

async function downloadToTemp(fileUrl: string): Promise<string> {
  const { promises: fs } = await import('fs');
  const os  = await import('os');
  const path = await import('path');

  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Failed to download file: ${resp.status}`);

  const ext = path.extname(new URL(fileUrl).pathname) || '.bin';
  const tmpPath = path.join(os.tmpdir(), `lib_upload_${Date.now()}${ext}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}
