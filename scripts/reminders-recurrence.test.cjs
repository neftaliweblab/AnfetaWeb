const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const file of ['202610060001_accounts_preferences.sql','202610060003_reminders.sql','202610070012_reminders_snooze.sql','202610070013_reminders_recurrence.sql'])await db.exec(fs.readFileSync(__dirname+'/../supabase/migrations/'+file,'utf8'));
 // Migration can be reapplied without dropping data.
 await db.exec(fs.readFileSync(__dirname+'/../supabase/migrations/202610070013_reminders_recurrence.sql','utf8'));
 for(const [id,tag] of [[a,'nneft'],[b,'jjohn'],[c,'ggena']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.profiles(id,login_email,person_tag) values($1,$2,$3)',[id,tag+'@example.test',tag]);}
 await db.exec('set role service_role');
 const edit=async(actor,action,id,revision,date,repeat,title='Revisión mensual')=>(await db.query("select to_jsonb(public.edit_reminder($1,$2,$3,$4,$5,$6,'12:30','high',$7,$8)) item",[actor,action,id,revision,title,date,b,repeat])).rows[0].item;
 const complete=async(actor,item,done=true)=>(await db.query("select to_jsonb(public.change_reminder($1,'complete',$2,$3,null,null,null,null,null,$4)) item",[actor,item.id,item.revision,done])).rows[0].item;
 const successor=async(id)=>(await db.query('select to_jsonb(r) item from public.reminders r where previous_id=$1',[id])).rows.map(row=>row.item);
 let jan=await edit(a,'create',null,null,'2024-01-31','monthly');
 jan=await complete(b,jan);let feb=(await successor(jan.id))[0];assert.equal(String(feb.due_date).slice(0,10),'2024-02-29');assert.equal(feb.recurrence_day,31);assert.equal(feb.creator_id,a);assert.equal(feb.assignee_id,b);
 // Unmark and mark again preserves the existing successor.
 jan=await complete(a,jan,false);jan=await complete(a,jan);assert.equal((await successor(jan.id)).length,1);
 feb=await complete(b,feb);const march=(await successor(feb.id))[0];assert.equal(String(march.due_date).slice(0,10),'2024-03-31');
 await assert.rejects(()=>edit(b,'edit',march.id,march.revision,'2024-04-10','weekly'),/not_available/);
 await assert.rejects(()=>edit(a,'edit',march.id,99,'2024-04-10','weekly'),/revision_conflict/);
 let changed=await edit(a,'edit',march.id,march.revision,'2024-04-10','weekly','Nuevo título');assert.equal(changed.title,'Nuevo título');assert.equal(changed.recurrence_day,10);
 changed=await complete(b,changed);assert.equal(String((await successor(changed.id))[0].due_date).slice(0,10),'2024-04-17');
 await assert.rejects(()=>edit(a,'edit',changed.id,changed.revision,'2024-04-10','none'),/completed_reminder/);
 await assert.rejects(()=>complete(c,changed),/not_available/);
 for(const [date,repeat,expected] of [['2026-12-31','daily','2027-01-01'],['2026-12-28','weekly','2027-01-04'],['2026-01-31','monthly','2026-02-28']]){let item=await edit(a,'create',null,null,date,repeat);item=await complete(a,item);assert.equal(String((await successor(item.id))[0].due_date).slice(0,10),expected);}
 let one=await edit(a,'create',null,null,'2026-10-07','none');one=await complete(a,one);assert.equal((await successor(one.id)).length,0);
 await assert.rejects(()=>edit(a,'create',null,null,'2026-10-07','yearly'),/invalid_reminder/);
 await db.exec('reset role;set role authenticated');await assert.rejects(()=>edit(a,'create',null,null,'2026-10-07','daily'),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[c]);assert.equal((await db.query('select * from public.reminders')).rows.length,0);
 await db.close();console.log('OK repetición/edición: permisos, conflictos, sucesor único, reabrir/completar, mensual sin deriva, bisiestos, cambio de año y migración repetible.');
})().catch(e=>{console.error(e);process.exitCode=1});
