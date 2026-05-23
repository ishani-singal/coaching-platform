-- Modules and programs are now published by default.
-- No manual publish step is required before a package can be published.
alter table modules alter column is_published set default true;
alter table programs alter column is_published set default true;

-- Backfill existing rows so no legacy content is stuck in draft state.
update modules set is_published = true where is_published = false;
update programs set is_published = true where is_published = false;
