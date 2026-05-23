-- Merge module_sections into modules as a JSONB array column.
-- Each module row now carries its own sections; the separate table is dropped.

-- 1. Add sections column (array of {section_id, section_order, content_type, body})
ALTER TABLE modules ADD COLUMN sections jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill existing rows
UPDATE modules m
SET sections = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'section_id',    ms.section_id,
      'section_order', ms.section_order,
      'content_type',  ms.content_type,
      'body',          ms.body
    )
    ORDER BY ms.section_order
  )
  FROM module_sections ms
  WHERE ms.module_id = m.module_id
), '[]'::jsonb);

-- 3. RPC: append a new section (generates UUID server-side, returns section object)
CREATE OR REPLACE FUNCTION append_module_section(
  p_module_id     uuid,
  p_section_order int,
  p_content_type  text,
  p_body          jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id  uuid := gen_random_uuid();
  v_sec jsonb;
BEGIN
  v_sec := jsonb_build_object(
    'section_id',    v_id,
    'section_order', p_section_order,
    'content_type',  p_content_type,
    'body',          p_body
  );
  UPDATE modules SET sections = sections || jsonb_build_array(v_sec)
  WHERE module_id = p_module_id;
  RETURN v_sec;
END;
$$;

-- 4. RPC: patch an existing section by section_id
CREATE OR REPLACE FUNCTION update_module_section(
  p_module_id     uuid,
  p_section_id    uuid,
  p_content_type  text  DEFAULT NULL,
  p_body          jsonb DEFAULT NULL,
  p_section_order int   DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE modules
  SET sections = (
    SELECT jsonb_agg(
      CASE WHEN (elem->>'section_id') = p_section_id::text
        THEN elem
          || CASE WHEN p_content_type  IS NOT NULL THEN jsonb_build_object('content_type',  p_content_type)  ELSE '{}'::jsonb END
          || CASE WHEN p_body          IS NOT NULL THEN jsonb_build_object('body',          p_body)          ELSE '{}'::jsonb END
          || CASE WHEN p_section_order IS NOT NULL THEN jsonb_build_object('section_order', p_section_order) ELSE '{}'::jsonb END
        ELSE elem
      END
      ORDER BY (
        CASE WHEN (elem->>'section_id') = p_section_id::text
          THEN COALESCE(p_section_order, (elem->>'section_order')::int)
          ELSE (elem->>'section_order')::int
        END
      )
    )
    FROM jsonb_array_elements(sections) elem
  )
  WHERE module_id = p_module_id;
$$;

-- 5. RPC: remove a section by section_id
CREATE OR REPLACE FUNCTION delete_module_section(
  p_module_id  uuid,
  p_section_id uuid
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE modules
  SET sections = (
    SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'section_order')::int), '[]'::jsonb)
    FROM jsonb_array_elements(sections) elem
    WHERE (elem->>'section_id') != p_section_id::text
  )
  WHERE module_id = p_module_id;
$$;

-- 6. RPC: reassign section_order values given an ordered list of section IDs
CREATE OR REPLACE FUNCTION reorder_module_sections(
  p_module_id   uuid,
  p_ordered_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE modules
  SET sections = (
    SELECT jsonb_agg(elem || jsonb_build_object('section_order', ord.idx) ORDER BY ord.idx)
    FROM jsonb_array_elements(sections) elem
    JOIN (
      SELECT unnest(p_ordered_ids) AS sid,
             generate_subscripts(p_ordered_ids, 1) - 1 AS idx
    ) ord ON (elem->>'section_id') = ord.sid::text
  )
  WHERE module_id = p_module_id;
END;
$$;

-- 7. Drop module_sections (CASCADE removes its RLS policies and indexes)
DROP TABLE module_sections;
