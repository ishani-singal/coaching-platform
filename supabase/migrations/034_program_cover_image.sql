-- Add cover_image_url to programs so programs can have thumbnails like packages
alter table programs
  add column if not exists cover_image_url text;
