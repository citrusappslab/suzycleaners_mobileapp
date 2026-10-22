-- In-app account deletion (App Store Review Guideline 5.1.1(v)).
-- A signed-in customer can delete only their own account. Deleting the auth user
-- cascades to the profile, and from there to that customer's orders, messages
-- and notifications. Staff accounts are refused so the business can't lock
-- itself out of the admin from the app.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'customer' then
    raise exception 'Only customer accounts can be deleted from the app.' using errcode = '42501';
  end if;
  delete from auth.users where id = me.id;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
