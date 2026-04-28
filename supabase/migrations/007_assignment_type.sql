-- Add 'assignment' compound content type.
-- An assignment section holds an ordered list of mixed blocks (text, image, video,
-- questions, upload prompts, image-based questions) stored as a jsonb array in body.items.
alter table module_sections
  drop constraint module_sections_content_type_check;

alter table module_sections
  add constraint module_sections_content_type_check
  check (content_type in (
    'text', 'video', 'pdf', 'task', 'check_in', 'quiz', 'facilitation_guide',
    'long_form_qa', 'single_choice', 'multi_choice', 'match_following', 'rating',
    'assignment'
  ));
