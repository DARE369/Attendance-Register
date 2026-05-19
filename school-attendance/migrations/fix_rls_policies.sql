-- ──────────────────────────────────────────────────────────────────────────────
-- RLS Policy Fix — run once in Supabase SQL Editor
-- Allows all operations through the Flask backend (anon key + service_role key).
-- Security is enforced at the Flask API layer (JWT tokens), not at the DB layer.
-- ──────────────────────────────────────────────────────────────────────────────

-- Helper: drop a policy if it already exists before recreating it
-- (run each block separately if you hit conflicts)

-- students
DROP POLICY IF EXISTS "allow_all" ON students;
CREATE POLICY "allow_all" ON students FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- teachers
DROP POLICY IF EXISTS "allow_all" ON teachers;
CREATE POLICY "allow_all" ON teachers FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- attendance_logs
DROP POLICY IF EXISTS "allow_all" ON attendance_logs;
CREATE POLICY "allow_all" ON attendance_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- teacher_attendance_logs
DROP POLICY IF EXISTS "allow_all" ON teacher_attendance_logs;
CREATE POLICY "allow_all" ON teacher_attendance_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- staff_type_config
DROP POLICY IF EXISTS "allow_all" ON staff_type_config;
CREATE POLICY "allow_all" ON staff_type_config FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- admins
DROP POLICY IF EXISTS "allow_all" ON admins;
CREATE POLICY "allow_all" ON admins FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- notification_settings
DROP POLICY IF EXISTS "allow_all" ON notification_settings;
CREATE POLICY "allow_all" ON notification_settings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- audit_logs
DROP POLICY IF EXISTS "allow_all" ON audit_logs;
CREATE POLICY "allow_all" ON audit_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- holidays  (created in phase10.sql)
DROP POLICY IF EXISTS "allow_all" ON holidays;
CREATE POLICY "allow_all" ON holidays FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- fraud_alerts  (created in phase10.sql)
DROP POLICY IF EXISTS "allow_all" ON fraud_alerts;
CREATE POLICY "allow_all" ON fraud_alerts FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
