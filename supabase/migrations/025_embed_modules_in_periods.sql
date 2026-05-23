-- Denormalize program_modules into programs.periods JSONB.
-- Each period now carries its own modules array: [{module_id, display_order}].
-- Flat modules (period_id IS NULL in program_modules) are placed into an
-- implicit period with period_order=0, label='', period_type='custom'.
-- The period_id field is removed from period objects; periods are now
-- identified solely by period_order (integer).

DO $$
DECLARE
  prog          RECORD;
  flat_modules  jsonb;
  updated_periods jsonb;
BEGIN
  FOR prog IN SELECT program_id, periods FROM programs LOOP

    -- Step 1: Inject modules into matching periods (by period_id in JSONB)
    updated_periods := COALESCE((
      SELECT jsonb_agg(
        p.period_obj || jsonb_build_object(
          'modules', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'module_id',     pm.module_id,
                'display_order', pm.display_order
              )
              ORDER BY pm.display_order
            )
            FROM program_modules pm
            WHERE pm.program_id = prog.program_id
              AND pm.period_id IS NOT NULL
              AND pm.period_id::text = (p.period_obj->>'period_id')
          ), '[]'::jsonb)
        )
        ORDER BY (p.period_obj->>'period_order')::int
      )
      FROM jsonb_array_elements(COALESCE(prog.periods, '[]'::jsonb)) AS p(period_obj)
    ), '[]'::jsonb);

    -- Step 2: Collect flat modules (period_id IS NULL)
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'module_id',     pm.module_id,
          'display_order', pm.display_order
        )
        ORDER BY pm.display_order
      ),
      NULL
    )
    INTO flat_modules
    FROM program_modules pm
    WHERE pm.program_id = prog.program_id AND pm.period_id IS NULL;

    IF flat_modules IS NOT NULL THEN
      IF jsonb_array_length(updated_periods) = 0 THEN
        -- No existing periods: create a single implicit period
        updated_periods := jsonb_build_array(
          jsonb_build_object(
            'period_order', 0,
            'label',        '',
            'period_type',  'custom',
            'modules',      flat_modules
          )
        );
      ELSE
        -- Shift all existing period_order values up by 1, prepend implicit period
        updated_periods := jsonb_build_array(
          jsonb_build_object(
            'period_order', 0,
            'label',        '',
            'period_type',  'custom',
            'modules',      flat_modules
          )
        ) || (
          SELECT COALESCE(
            jsonb_agg(
              p.period_obj || jsonb_build_object(
                'period_order', (p.period_obj->>'period_order')::int + 1
              )
              ORDER BY (p.period_obj->>'period_order')::int
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(updated_periods) AS p(period_obj)
        );
      END IF;
    END IF;

    -- Step 3: Strip period_id from every period object
    updated_periods := COALESCE((
      SELECT jsonb_agg(
        p.period_obj - 'period_id'
        ORDER BY (p.period_obj->>'period_order')::int
      )
      FROM jsonb_array_elements(updated_periods) AS p(period_obj)
    ), '[]'::jsonb);

    UPDATE programs SET periods = updated_periods WHERE program_id = prog.program_id;

  END LOOP;
END;
$$;

-- Step 4: Drop the now-redundant table
DROP TABLE IF EXISTS program_modules CASCADE;
