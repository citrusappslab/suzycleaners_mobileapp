-- Only needed if you created the staff login yourself instead of using the
-- demo accounts in setup.sql. Run in the Supabase SQL editor after creating
-- the user in Authentication → Users → "Add user" ("Auto confirm user" on).
-- The SQL editor runs with full rights, so this is the only way to grant admin.

update public.profiles
   set role = 'admin', name = 'Suzy''s Team'
 where email = 'admin@suzyscleaners.com';

-- Check it worked:
select id, email, role from public.profiles where role = 'admin';
