const fs=require('fs'),assert=require('assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 const sql=fs.readFileSync(__dirname+'/../supabase/migrations/202610150018_activity_handoffs.sql','utf8');await db.exec(sql);await db.exec(sql);
 const acl=await db.query("select has_table_privilege('authenticated','public.activity_handoffs','SELECT') allowed");assert.equal(acl.rows[0].allowed,false);
 await db.query("insert into public.activity_handoffs(id,source_key,page_id,from_person,to_person,actor,snapshot) values('11111111-1111-1111-1111-111111111111','source','page','Neftali','Karla','Neftali',$1)",[JSON.stringify({start:'2026-10-15T10:00:00-06:00',end:'2026-10-15T11:00:00-06:00',checklistCompleted:3})]);
 let result=await db.query('select * from public.activity_handoffs where confirmed=true');assert.equal(result.rows.length,0);
 await db.exec("update public.activity_handoffs set confirmed=true");result=await db.query("select * from public.activity_handoffs where confirmed=true and snapshot->>'start'>='2026-10-15' and snapshot->>'start'<'2026-10-16'");assert.equal(result.rows.length,1);assert.equal(result.rows[0].snapshot.checklistCompleted,3);
 console.log('OK migración: idempotente, acceso directo restringido, snapshots pendientes ocultos y lectura por fecha independiente del original. PostgreSQL local PGlite.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
