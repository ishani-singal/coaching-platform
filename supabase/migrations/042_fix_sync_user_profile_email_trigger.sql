-- Fix: wrap sync_user_profile_email trigger body in EXCEPTION handler so it
-- never blocks auth.users INSERT (which caused "Database error creating new
-- user" / unexpected_failure on signup).
DROP TRIGGER IF EXISTS trg_sync_user_profile_email ON auth.users;

CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    UPDATE user_profiles SET email = new.email WHERE user_id = new.id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block auth.users operations
  END;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_sync_user_profile_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE sync_user_profile_email();
