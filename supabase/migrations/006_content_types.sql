-- Expand module_sections.content_type to support rich question/assignment types.
-- The auto-generated constraint name from 002_programs_schema.sql is module_sections_content_type_check.
alter table module_sections
  drop constraint module_sections_content_type_check;

alter table module_sections
  add constraint module_sections_content_type_check
  check (content_type in (
    -- existing types (unchanged)
    'text', 'video', 'pdf', 'task', 'check_in', 'quiz', 'facilitation_guide',
    -- new rich content types
    'long_form_qa',   -- written assignment: question + optional hint + optional min word count
    'single_choice',  -- quiz: one correct answer from a list of options
    'multi_choice',   -- quiz: one or more correct answers
    'match_following',-- matching exercise: pairs of left/right items
    'rating'          -- rating scale: numeric response with low/high labels
  ));
