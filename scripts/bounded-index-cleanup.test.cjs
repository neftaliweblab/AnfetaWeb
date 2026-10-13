const fs=require('fs'),vm=require('vm'),path=require('path');
const filename=path.join(__dirname,'index-load-control.test.cjs');
let source=fs.readFileSync(filename,'utf8');
source=source.replace("await db.query('insert into auth.users values($1)'", "await db.exec(fs.readFileSync(__dirname+'/../supabase/migrations/202610130016_bounded_index_cleanup.sql','utf8'));await db.exec(fs.readFileSync(__dirname+'/../supabase/migrations/202610130016_bounded_index_cleanup.sql','utf8'));await assert.rejects(()=>db.query('select public.cleanup_obsolete_notion_chunks(2001)'),/invalid_cleanup_limit/);await db.query('select public.cleanup_obsolete_notion_chunks(2000)');await db.query('insert into auth.users values($1)'");
vm.runInThisContext('(function(require,__dirname){'+source+'})',{filename})(require,__dirname);
