import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Fetches the transcript/captions for a YouTube video.
 * Uses YouTube's public timedtext API (no OAuth required).
 * Returns full transcript as a single string, or null if no captions exist.
 */
export async function fetchYoutubeCaptions(
  videoId: string,
  lang = 'en'
): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang });
    if (!segments || segments.length === 0) return null;
    return segments.map(s => s.text.trim()).join(' ');
  } catch {
    // No captions available or video is private/restricted
    return null;
  }
}

/**
 * Extracts a videoId from a YouTube URL or returns the raw string if already an ID.
 */
export function extractVideoIdFromUrl(url: string): string {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  // Assume it's already a video ID if it's 11 chars
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  throw new Error(`Cannot extract video ID from: ${url}`);
}
