-- Demo logins for Suzy's Cleaners (safe to run more than once).
--
--   Admin:    admin@suzyscleaners.com / SuzyAdmin2026!
--   Customer: demo@suzyscleaners.com  / Demo1234!
--
-- These passwords are published in the README. Before launch, change the
-- admin password (Authentication → Users → ⋯ → Send password recovery, or
-- delete the user and create it again) and delete the demo customer.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.seed_demo_user(p_email text, p_password text, p_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    -- Token columns must be '' rather than NULL, or Supabase Auth fails to read the user.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', p_name, 'phone', p_phone), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (uid, uid::text, 'email', jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true), now(), now(), now());
  end if;
  return uid;
end $$;

do $$
declare
  admin_id uuid;
  demo_id uuid;
begin
  -- The on_auth_user_created trigger creates each profile as a customer…
  admin_id := public.seed_demo_user('admin@suzyscleaners.com', 'SuzyAdmin2026!', 'Suzy''s Team', '(747) 333-0034');
  demo_id := public.seed_demo_user('demo@suzyscleaners.com', 'Demo1234!', 'Alex Morgan', '(818) 555-0110');

  -- …then the staff account is promoted (only possible from SQL, never from the app).
  update public.profiles set role = 'admin', name = 'Suzy''s Team' where id = admin_id;

  update public.profiles
     set addresses = '[{"id": "adr-demo-1", "label": "Home", "line1": "840 N Glenoaks Blvd", "city": "Burbank", "state": "CA", "zip": "91502"},
                       {"id": "adr-demo-2", "label": "Office", "line1": "3900 W Alameda Ave", "city": "Burbank", "state": "CA", "zip": "91505"}]',
         default_address_id = 'adr-demo-1'
   where id = demo_id and addresses = '[]';
end $$;

drop function public.seed_demo_user(text, text, text, text);
