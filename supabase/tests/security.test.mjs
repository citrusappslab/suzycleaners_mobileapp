// Runs the Supabase migrations in an in-process Postgres (PGlite) with small
// stand-ins for Supabase's auth schema, pg_net and roles, then checks the
// security rules end to end. Run with: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH:', e.message, e.query ?? ''); process.exit(1); });
const M = new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
const expectErr = async (name, sql, params, re) => {
  try { await db.query(sql, params); ok(name, false, 'no error'); }
  catch (e) { ok(name, re ? re.test(e.message) : true, e.message); }
};

// ── Supabase stand-ins
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (
    instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text, email text unique,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb default '{}',
    created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
    email_change_token_new text, email_change text, email_change_token_current text, phone_change text,
    phone_change_token text, reauthentication_token text
  );
  create table auth.identities (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
    provider_id text not null, provider text not null, identity_data jsonb not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider)
  );
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema extensions; create schema net;
  create table net.calls (url text, body jsonb);
  create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.calls values (url, body); select 1::bigint $$;
  create publication supabase_realtime;
`);
for (const f of fs.readdirSync(M).sort()) {
  let sql = fs.readFileSync(M + f, 'utf8').replace(/create extension if not exists pg_net[^;]*;/, '');
  await db.exec(sql);
  results.push('migrated ' + f);
}
await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
`);

// ── users
const cust = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('alex@example.com', '{"name":"Alex Morgan","phone":"(818) 555-0110","role":"admin"}') returning id`)).rows[0].id;
const other = (await db.query(`insert into auth.users (email, raw_user_meta_data) values ('maria@example.com', '{"name":"Maria"}') returning id`)).rows[0].id;
// Demo accounts come from the demo_accounts migration.
const adm = (await db.query(`select id from auth.users where email = 'admin@suzyscleaners.com'`)).rows[0].id;
const demo = (await db.query(`select id from auth.users where email = 'demo@suzyscleaners.com'`)).rows[0].id;
const pw = async (email, password) =>
  (await db.query(`select encrypted_password = extensions.crypt($2, encrypted_password) ok from auth.users where email = $1`, [email, password])).rows[0].ok;
ok('demo admin password works', await pw('admin@suzyscleaners.com', 'SuzyAdmin2026!'));
ok('demo admin rejects wrong password', !(await pw('admin@suzyscleaners.com', 'wrong')));
ok('demo customer password works', await pw('demo@suzyscleaners.com', 'Demo1234!'));
ok('demo admin has admin role', (await db.query(`select role from profiles where id=$1`, [adm])).rows[0].role === 'admin');
ok('demo customer is a customer with saved addresses', (await db.query(`select role, jsonb_array_length(addresses) n from profiles where id=$1`, [demo])).rows.every((r) => r.role === 'customer' && r.n === 2));
ok('demo users have email identities', (await db.query(`select count(*)::int c from auth.identities where user_id in ($1, $2)`, [adm, demo])).rows[0].c === 2);
ok('auth token columns are not null', (await db.query(`select count(*)::int c from auth.users where id in ($1,$2) and (confirmation_token is null or recovery_token is null or email_change is null)`, [adm, demo])).rows[0].c === 0);
// Running the demo migration again must not duplicate anything.
await db.exec(fs.readFileSync(M + '20261013000000_demo_accounts.sql', 'utf8'));
ok('demo migration is re-runnable', (await db.query(`select count(*)::int c from auth.users where email like '%@suzyscleaners.com'`)).rows[0].c === 2);
ok('seed helper removed afterwards', (await db.query(`select count(*)::int c from pg_proc where proname = 'seed_demo_user'`)).rows[0].c === 0);
ok('signup metadata cannot grant admin', (await db.query(`select role from profiles where id=$1`, [cust])).rows[0].role === 'customer');
ok('welcome message created', (await db.query(`select count(*)::int c from messages where customer_id=$1 and sender='system'`, [cust])).rows[0].c === 1);

const as = async (role, uid) => { await db.exec(`reset role`); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']); await db.exec(`set role ${role}`); };
const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
const inside = { id: 'a1', label: 'Home', line1: '840 N Glenoaks Blvd', city: 'Burbank', state: 'CA', zip: '91502', latitude: 34.19, longitude: -118.30 };
const far = { ...inside, latitude: 33.7, longitude: -117.8 };
const lines = JSON.stringify([{ serviceId: 'dry-cleaning', quantity: 9 }, { serviceId: 'shoe-cleaning', quantity: 1 }]);
const createSql = `select * from create_order($1::jsonb, $2::jsonb, $3::date, $4, $5::jsonb, $6)`;

// ── customer
await as('authenticated', cust);
ok('customer sees only own profile', (await db.query(`select count(*)::int c from profiles`)).rows[0].c === 1);
await db.query(`update profiles set role='admin', reward_points=50000, name='Alex M', push_token='ExponentPushToken[abc]' where id=$1`, [cust]);
await db.exec('reset role');
const p = (await db.query(`select role, name, reward_points from profiles where id=$1`, [cust])).rows[0];
ok('customer cannot promote self or edit reward points', p.role === 'customer' && p.name === 'Alex M' && p.reward_points === 0);
await as('authenticated', cust);
const order = (await db.query(createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', lines, 'Leave with concierge'])).rows[0];
ok('create_order records no prices before invoice', order.lines.every((l) => !('unitPrice' in l)) && !('estimated_total' in order), `#${order.number}`);
await expectErr('rejects pickups under 10 pieces', createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', JSON.stringify([{ serviceId: 'dry-cleaning', quantity: 9 }]), ''], /10 pieces/);
await expectErr('rejects under-10 request despite client price', createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', JSON.stringify([{ serviceId: 'dry-cleaning', quantity: 1, unitPrice: 999 }]), ''], /10 pieces/);
await expectErr('rejects address outside radius', createSql, [JSON.stringify(far), JSON.stringify(far), tomorrow, '9–11 AM', lines, ''], /outside/);
await expectErr('rejects unknown time window', createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '1–2 AM', lines, ''], /time window/);
await expectErr('rejects past date', createSql, [JSON.stringify(inside), JSON.stringify(inside), '2020-01-01', '9–11 AM', lines, ''], /upcoming/);
await expectErr('rejects non-bookable service', createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', JSON.stringify([{ serviceId: 'pickup-delivery', quantity: 5 }, { serviceId: 'dry-cleaning', quantity: 4 }]), ''], /no longer available/);
await expectErr('customer cannot insert orders directly', `insert into orders (customer_id, customer_name, customer_phone, customer_email, pickup_address, delivery_address, pickup_date, time_window, lines) values ($1,'x','x','x','{}','{}',now(),'x','[]')`, [cust], /row-level security/);
await expectErr('customer cannot call admin_update_order', `select admin_update_order($1, 'completed')`, [order.id], /access/);
await expectErr('customer cannot list customers', `select * from admin_list_customers()`, [], /access/);
ok('customer received request notification', (await db.query(`select count(*)::int c from notifications`)).rows[0].c === 1);
await db.exec('reset role');
ok('push sent for request notification', (await db.query(`select count(*)::int c from net.calls`, [])).rows[0].c === 1);
await as('authenticated', cust);
await db.query(`select * from send_my_message('Can I get it by Friday?', $1, 'order')`, [order.id]);
await expectErr('customer cannot message about others’ orders', `select * from send_my_message('hi', gen_random_uuid())`, [], /access/);

// ── other customer isolation
await as('authenticated', other);
ok('other customer cannot see Alex’s order', (await db.query(`select count(*)::int c from orders`)).rows[0].c === 0);
ok('other customer cannot see Alex’s messages', (await db.query(`select count(*)::int c from messages where customer_id=$1`, [cust])).rows[0].c === 0);
await expectErr('other customer cannot cancel Alex’s order', `select * from cancel_my_order($1)`, [order.id], /not found/);
await db.query(`update orders set status='completed' where id=$1`, [order.id]); // silently affects 0 rows under RLS

// ── anon
await as('anon', null);
ok('anon can read services', (await db.query(`select count(*)::int c from services`)).rows[0].c === 5);
ok('anon can read settings without stale dollar minimum', !(await db.query(`select data ? 'minimumOrder' has_minimum from settings`)).rows[0].has_minimum);
ok('business settings list Sunday as open', (await db.query(`select (h->>'closed')::boolean closed from settings, jsonb_array_elements(data->'hours') h where h->>'day'='Sun'`)).rows[0].closed === false);
ok('public service catalog does not expose prices', !(await db.query(`select to_jsonb(s) ? 'price' has_price from services s limit 1`)).rows[0].has_price);
await expectErr('anon cannot read orders', `select count(*) from orders`, [], /permission denied/);
await expectErr('anon cannot call create_order', createSql, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', lines, ''], /permission denied/);

// ── admin
await as('authenticated', adm);
ok('admin sees all orders', (await db.query(`select count(*)::int c from orders`)).rows[0].c === 1);
const custs = (await db.query(`select * from admin_list_customers()`)).rows;
ok('admin_list_customers', custs.length === 3 && custs.some((c) => c.admin_list_customers.order_count === 1), JSON.stringify(custs[0].admin_list_customers).slice(0, 120));
const convs = (await db.query(`select * from admin_list_conversations()`)).rows;
ok('admin_list_conversations (unread=1)', convs.length === 1 && convs[0].admin_list_conversations.unread === 1);
const upd = (await db.query(`select * from admin_update_order($1, 'ready_for_delivery', true, 68, null, 'Ready for delivery', 'Your order is ready for delivery.')`, [order.id])).rows[0];
ok('admin_update_order sets status + final total + history', upd.status === 'ready_for_delivery' && Number(upd.final_total) === 68 && upd.history.length === 2);
await db.query(`select * from admin_update_order($1, 'completed', true, 10000)`, [order.id]);
ok('completed invoice awards 10 points per $100', Number((await db.query(`select reward_points from profiles where id=$1`, [cust])).rows[0].reward_points) === 1000);
await db.query(`select * from admin_update_order($1, 'completed', true, 10000)`, [order.id]);
ok('invoice points cannot be awarded twice', Number((await db.query(`select reward_points from profiles where id=$1`, [cust])).rows[0].reward_points) === 1000);
await db.query(`select admin_mark_conversation_read($1)`, [cust]);
await db.query(`select * from admin_send_message($1, 'Yes, Friday by 5 PM works!', $2)`, [cust, order.id]);
await db.query(`update settings set data = jsonb_set(data, '{serviceRadiusMiles}', '21') where id = 1`);
await db.query(`update profiles set role='customer' where id=$1`, [cust]); // admin may edit profiles? (no policy → 0 rows)

// ── customer sees result
await as('authenticated', cust);
const mine = (await db.query(`select status, final_total from orders where id=$1`, [order.id])).rows[0];
ok('customer sees admin status update', mine.status === 'completed' && Number(mine.final_total) === 10000);
const rewardLines = JSON.stringify([{ serviceId: 'dry-cleaning', quantity: 10 }]);
const rewardOrder = (await db.query(`select * from create_order($1::jsonb,$2::jsonb,$3::date,$4,$5::jsonb,$6,true,true)`, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', rewardLines, ''])).rows[0];
ok('eligible customer can request next-day service and reward', rewardOrder.next_day_service_requested && rewardOrder.reward_redemption_requested);
await expectErr('cannot reserve the same reward on another open order', `select * from create_order($1::jsonb,$2::jsonb,$3::date,$4,$5::jsonb,$6,false,true)`, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', rewardLines, ''], /available points/);
await db.query(`select * from cancel_my_order($1)`, [rewardOrder.id]);
ok('cancelling an open order releases its reward reservation', (await db.query(`select reward_redemption_requested from orders where id=$1`, [rewardOrder.id])).rows[0].reward_redemption_requested === false);
const activeRewardOrder = (await db.query(`select * from create_order($1::jsonb,$2::jsonb,$3::date,$4,$5::jsonb,$6,true,true)`, [JSON.stringify(inside), JSON.stringify(inside), tomorrow, '9–11 AM', rewardLines, ''])).rows[0];
await db.exec('reset role');
await as('authenticated', adm);
await expectErr('invoice cannot be sent before inspection', `select * from admin_update_order($1, null, true, 150)`, [activeRewardOrder.id], /after the items have been inspected/);
const redeemed = (await db.query(`select * from admin_update_order($1, 'cleaning_in_progress', true, 150)`, [activeRewardOrder.id])).rows[0];
ok('admin invoice applies requested $100 reward', Number(redeemed.final_total) === 50 && Number(redeemed.reward_discount) === 100);
await db.query(`select * from admin_update_order($1, null, true, 50)`, [activeRewardOrder.id]);
ok('reward redemption cannot be charged twice', Number((await db.query(`select reward_points from profiles where id=$1`, [cust])).rows[0].reward_points) === 0);
await as('authenticated', cust);
const notes = (await db.query(`select title from notifications order by created_at`)).rows.map((r) => r.title);
ok('customer notifications', notes.length === 5, notes.join(' | '));
const msgs = (await db.query(`select sender from messages order by created_at`)).rows.map((r) => r.sender);
ok('customer thread', msgs.join(',') === 'system,customer,admin,admin', msgs.join(','));
await db.query(`select mark_my_messages_read()`);
await db.query(`select mark_my_notifications_read()`);
ok('read flags updated', (await db.query(`select count(*)::int c from notifications where not read`)).rows[0].c === 0);
await db.query(`update settings set data='{}' where id=1`); // RLS: silently updates 0 rows
await db.exec('reset role');
ok('settings unchanged by customer', (await db.query(`select (data->>'serviceRadiusMiles')::int m from settings`)).rows[0].m === 21);
ok('service catalog pricing column is removed', !(await db.query(`select count(*)::int c from information_schema.columns where table_schema='public' and table_name='services' and column_name='price'`)).rows[0].c);
ok('pushes sent (request, status, message, reward-order requests)', (await db.query(`select count(*)::int c from net.calls`)).rows[0].c === 5);
await as('authenticated', cust);
await expectErr('customer cannot cancel after pickup', `select * from cancel_my_order($1)`, [order.id], /no longer be cancelled/);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(failed.length ? `\n${failed.length} FAILED` : `\nAll ${results.filter((r) => r.startsWith('PASS')).length} checks passed`);
process.exit(failed.length ? 1 : 0);
