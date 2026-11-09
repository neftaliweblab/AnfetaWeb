const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create table public.profiles(id uuid primary key, active boolean not null default true);
    `);
    for (const migration of ['202610060004_presence.sql', '202611090001_ftf_daily_presence.sql']) {
      await db.exec(readFileSync(join(__dirname, '../supabase/migrations', migration), 'utf8'));
    }
    const person = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    await db.query('insert into public.profiles(id) values($1)', [person]);
    const heartbeat = (time) => db.query(`
      insert into public.team_presence(user_id,last_seen) values($1,$2)
      on conflict(user_id) do update set last_seen=excluded.last_seen
    `, [person,time]);
    await heartbeat('2026-11-10T05:59:00Z');
    await heartbeat('2026-11-09T16:00:00Z');
    await heartbeat('2026-11-09T20:00:00Z');
    await heartbeat('2026-11-10T06:01:00Z');
    const {rows} = await db.query('select day::text,first_seen,last_seen from public.ftf_daily_presence order by day');
    assert.deepEqual(rows.map(row=>[row.day,row.first_seen.toISOString(),row.last_seen.toISOString()]), [
      ['2026-11-09','2026-11-09T16:00:00.000Z','2026-11-10T05:59:00.000Z'],
      ['2026-11-10','2026-11-10T06:01:00.000Z','2026-11-10T06:01:00.000Z'],
    ]);
    await db.exec('set role authenticated');
    await assert.rejects(()=>db.query('select * from public.ftf_daily_presence'),/permission denied/);
    await db.exec('reset role');
    console.log('OK PostgreSQL: primera y última señal, latidos fuera de orden, medianoche CDMX y acceso restringido.');
  } finally {
    await db.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
