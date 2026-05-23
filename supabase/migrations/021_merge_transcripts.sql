-- Merge video_transcripts into coach_library_items.
-- The tables have a strict 1:1 relationship; folding removes the join.

alter table coach_library_items
  add column if not exists transcript          text,
  add column if not exists transcript_source   text check (transcript_source in ('youtube_captions', 'whisper')),
  add column if not exists transcript_language text not null default 'en',
  add column if not exists chunks_indexed      boolean not null default false;

-- Migrate existing transcript rows
update coach_library_items cli
set
  transcript          = vt.transcript,
  transcript_source   = vt.source,
  transcript_language = vt.language,
  chunks_indexed      = vt.chunks_indexed
from video_transcripts vt
where cli.item_id = vt.library_item_id;

drop table video_transcripts;
