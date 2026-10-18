-- Customer rewards, invoice-only pricing, minimum item count, and next-day requests.
-- Run after the initial schema and catalog migrations.

alter table public.profiles
  add column if not exists reward_points integer not null default 0 check (reward_points >= 0);

alter table public.orders
  add column if not exists next_day_service_requested boolean not null default false,
  add column if not exists reward_redemption_requested boolean not null default false,
  add column if not exists reward_discount numeric(10, 2) not null default 0 check (reward_discount >= 0),
  add column if not exists points_awarded integer not null default 0 check (points_awarded >= 0);

-- Prices are no longer exposed through the public service catalog or order rows.
update public.orders o
set lines = coalesce((
  select jsonb_agg(line - 'unitPrice')
  from jsonb_array_elements(o.lines) as x(line)
), '[]'::jsonb);
alter table public.orders drop column if exists estimated_total;
alter table public.services drop column if exists price, drop column if exists unit_label;
update public.settings set data = data - 'minimumOrder' where id = 1;
update public.services
set description = 'We collect from your home or office and return everything fresh, pressed and on hangers. Pickups require at least 10 pieces.',
    highlights = array['10-piece pickup minimum', 'Next-day turnaround on request', 'Contact-free drop-off']
where id = 'pickup-delivery';

-- Public hours and bookable dates are open every day, including Sunday.
update public.settings s
set data = jsonb_set(
  s.data,
  '{hours}',
  coalesce((
    select jsonb_agg(
      case when h ->> 'day' = 'Sun'
        then h || '{"open":"8:00 AM","close":"5:00 PM","closed":false}'::jsonb
        else h
      end order by ord
    )
    from jsonb_array_elements(s.data -> 'hours') with ordinality as x(h, ord)
  ), '[]'::jsonb)
)
where s.id = 1 and jsonb_typeof(s.data -> 'hours') = 'array';

create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
    new.reward_points := old.reward_points;
  end if;
  return new;
end $$;

-- Replace the old overload so clients cannot bypass the new item-count rule.
drop function if exists public.create_order(jsonb, jsonb, date, text, jsonb, text);
create function public.create_order(
  p_pickup_address jsonb,
  p_delivery_address jsonb,
  p_pickup_date date,
  p_time_window text,
  p_lines jsonb,
  p_instructions text default '',
  p_next_day_service boolean default false,
  p_redeem_reward boolean default false
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  s jsonb;
  l jsonb;
  svc public.services;
  qty int;
  piece_count int := 0;
  reserved_points int := 0;
  v_lines jsonb := '[]';
  o public.orders;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if not found or me.role <> 'customer' then
    raise exception 'Please sign in with a customer account.' using errcode = '42501';
  end if;
  select data into s from public.settings where id = 1;

  -- Customer selection records service and quantity only: the representative invoices after inspection.
  for l in select * from jsonb_array_elements(p_lines) loop
    qty := least(99, greatest(0, round(coalesce((l ->> 'quantity')::numeric, 0))));
    continue when qty = 0;
    select * into svc from public.services where id = l ->> 'serviceId' and active and bookable;
    if not found then raise exception 'One of the selected services is no longer available.'; end if;
    v_lines := v_lines || jsonb_build_object('serviceId', svc.id, 'name', svc.name, 'quantity', qty);
    piece_count := piece_count + qty;
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'Please choose at least one service.'; end if;
  if piece_count < 10 then raise exception 'Pickup requests require at least 10 pieces.'; end if;
  if p_redeem_reward then
    select count(*)::integer * 1000 into reserved_points
      from public.orders
     where customer_id = me.id and reward_redemption_requested and reward_discount = 0 and status <> 'cancelled';
    if me.reward_points - coalesce(reserved_points, 0) < 1000 then
      raise exception 'You need 1,000 available points to redeem $100 off.';
    end if;
  end if;
  if p_pickup_date < (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'Please choose an upcoming pickup date.';
  end if;
  if p_time_window is null or not (s -> 'timeWindows') ? p_time_window then
    raise exception 'Please choose one of our pickup time windows.';
  end if;
  perform public.check_service_area(p_pickup_address, s);
  perform public.check_service_area(p_delivery_address, s);

  insert into public.orders (customer_id, customer_name, customer_phone, customer_email, pickup_address, delivery_address,
                             pickup_date, time_window, lines, instructions, next_day_service_requested,
                             reward_redemption_requested, status, history)
  values (me.id, me.name, me.phone, me.email, p_pickup_address, p_delivery_address, p_pickup_date, p_time_window,
          v_lines, left(coalesce(p_instructions, ''), 500), coalesce(p_next_day_service, false),
          coalesce(p_redeem_reward, false), 'request_received',
          jsonb_build_array(public.history_event('request_received', 'customer')))
  returning * into o;

  insert into public.notifications (user_id, title, body, order_id, status)
  values (me.id, s -> 'notificationTemplates' -> 'request_received' ->> 'title',
          s -> 'notificationTemplates' -> 'request_received' ->> 'body', o.id, 'request_received');
  return o;
end $$;

create or replace function public.cancel_my_order(p_order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status not in ('request_received', 'pickup_confirmed') then
    raise exception 'This order can no longer be cancelled in the app. Please message us.';
  end if;
  update public.orders
     set status = 'cancelled', reward_redemption_requested = false, reward_discount = 0,
         final_total = null, updated_at = now(),
         history = history || jsonb_build_array(public.history_event('cancelled', 'customer', 'Cancelled by customer'))
   where id = p_order_id returning * into o;
  return o;
end $$;

create or replace function public.admin_list_customers() returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
  select to_jsonb(p) || jsonb_build_object(
           'order_count', (select count(*) from public.orders o where o.customer_id = p.id),
           'lifetime_value', (select coalesce(sum(o.final_total), 0)
                                from public.orders o where o.customer_id = p.id and o.status <> 'cancelled'),
           'last_order_at', (select max(o.created_at) from public.orders o where o.customer_id = p.id),
           'unread_for_admin', (select count(*) from public.messages m where m.customer_id = p.id and not m.read_by_admin))
    from public.profiles p
   where p.role = 'customer'
   order by coalesce((select max(o.created_at) from public.orders o where o.customer_id = p.id), p.created_at) desc;
end $$;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status public.order_status default null,
  p_set_final_total boolean default false,
  p_final_total numeric default null,
  p_note text default null,
  p_notify_title text default null,
  p_notify_body text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  customer_points integer;
  reserved_points integer;
  earned integer;
begin
  perform public.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if p_status is not null and p_status <> o.status then
    o.status := p_status;
    o.history := o.history || jsonb_build_array(public.history_event(p_status, 'admin', p_note));
  end if;
  if p_set_final_total then
    if p_final_total is not null and p_final_total < 0 then raise exception 'Final total must be positive.'; end if;
    if p_final_total is not null and o.status not in ('cleaning_in_progress', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'completed') then
      raise exception 'Send the final invoice after the items have been inspected.';
    end if;
    if p_final_total is not null and o.reward_redemption_requested and o.reward_discount = 0 then
      select reward_points into customer_points from public.profiles where id = o.customer_id for update;
      select count(*)::integer * 1000 into reserved_points
        from public.orders
       where customer_id = o.customer_id and id <> o.id and reward_redemption_requested
         and reward_discount = 0 and status <> 'cancelled';
      if coalesce(customer_points, 0) - coalesce(reserved_points, 0) < 1000 then
        raise exception 'This customer no longer has enough points to redeem the $100 reward.';
      end if;
      if p_final_total < 100 then raise exception 'The invoice must be at least $100 before applying the reward.'; end if;
      update public.profiles set reward_points = reward_points - 1000 where id = o.customer_id;
      o.reward_discount := 100;
      o.final_total := p_final_total - 100;
    else
      o.final_total := p_final_total;
    end if;
  end if;

  update public.orders set status = o.status, history = o.history, final_total = o.final_total,
         reward_discount = o.reward_discount, updated_at = now()
   where id = p_order_id returning * into o;

  -- Points are granted once, when the inspected invoice is finalized and the order is complete.
  if o.status = 'completed' and o.final_total is not null and o.points_awarded = 0 then
    earned := floor(o.final_total / 100)::integer * 10;
    if earned > 0 then
      update public.profiles set reward_points = reward_points + earned where id = o.customer_id;
      update public.orders set points_awarded = earned where id = o.id returning * into o;
    end if;
  end if;

  if p_notify_body is not null and length(trim(p_notify_body)) > 0 then
    insert into public.notifications (user_id, title, body, order_id, status)
    values (o.customer_id, coalesce(nullif(trim(p_notify_title), ''), 'Order update'), trim(p_notify_body), o.id, o.status);
    insert into public.messages (customer_id, sender, sender_name, body, order_id, read_by_admin, read_by_customer)
    values (o.customer_id, 'admin', 'Suzy''s Cleaners', trim(p_notify_body), o.id, true, false);
  end if;
  return o;
end $$;

revoke execute on function public.create_order(jsonb, jsonb, date, text, jsonb, text, boolean, boolean) from public, anon;
grant execute on function public.create_order(jsonb, jsonb, date, text, jsonb, text, boolean, boolean) to authenticated;
revoke execute on function public.admin_update_order(uuid, public.order_status, boolean, numeric, text, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, public.order_status, boolean, numeric, text, text, text) to authenticated;
