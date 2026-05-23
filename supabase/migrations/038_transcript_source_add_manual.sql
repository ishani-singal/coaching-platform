-- Widen transcript_source check constraint to allow 'manual' and 'text-extraction'.
-- Previously only 'youtube_captions' and 'whisper' were accepted, which silently
-- blocked any update that tried to write a manually-entered transcript.

alter table coach_library_items
  drop constraint if exists coach_library_items_transcript_source_check;

alter table coach_library_items
  add constraint coach_library_items_transcript_source_check
    check (transcript_source in ('youtube_captions', 'whisper', 'manual', 'text-extraction'));
