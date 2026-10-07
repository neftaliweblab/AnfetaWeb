begin;
create table public.conversations(id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.profiles(id),title text not null check(length(trim(title)) between 1 and 200),members uuid[] not null check(cardinality(members) between 1 and 20),last_message_id bigint not null default 0,last_text text not null default '',updated_at timestamptz not null default now());
create table public.conversation_messages(id bigint generated always as identity primary key,conversation_id uuid not null references public.conversations(id) on delete cascade,author_id uuid not null references public.profiles(id),body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now());
create index conversation_messages_history on public.conversation_messages(conversation_id,id desc);
create table public.conversation_states(conversation_id uuid not null references public.conversations(id) on delete cascade,user_id uuid not null references public.profiles(id),last_read_id bigint not null default 0,status text not null default 'open' check(status in ('open','attention','archived')),primary key(conversation_id,user_id));
alter table public.conversations enable row level security;alter table public.conversation_messages enable row level security;alter table public.conversation_states enable row level security;
create policy conversations_member on public.conversations for select to authenticated using(auth.uid()=any(members) and exists(select 1 from public.profiles where id=auth.uid() and active));
create policy messages_member on public.conversation_messages for select to authenticated using(exists(select 1 from public.conversations where id=conversation_id));
create policy states_own on public.conversation_states for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.conversations where id=conversation_id));
grant select on public.conversations,public.conversation_messages,public.conversation_states to authenticated;
grant all on public.conversations,public.conversation_messages,public.conversation_states to service_role;grant usage,select on sequence public.conversation_messages_id_seq to service_role;
create function public.change_conversation(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare thread public.conversations; message public.conversation_messages; member_ids uuid[];target uuid;read_id bigint;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  select array_agg(distinct member) into member_ids from (select p_actor as member union all select value::uuid from jsonb_array_elements_text(p_input->'members')) m;
  if exists(select 1 from unnest(member_ids) as member where not exists(select 1 from public.profiles where id=member and active)) then raise exception 'inactive_member';end if;
  insert into public.conversations(creator_id,title,members) values(p_actor,p_input->>'title',member_ids) returning * into thread;
 else
  target:=(p_input->>'thread')::uuid;select * into thread from public.conversations where id=target for update;
  if thread.id is null or not(p_actor=any(thread.members)) then raise exception 'conversation_not_available';end if;
 end if;
 if p_action in ('create','send') then
  insert into public.conversation_messages(conversation_id,author_id,body) values(thread.id,p_actor,p_input->>'text') returning * into message;
  update public.conversations set last_message_id=message.id,last_text=left(message.body,180),updated_at=now() where id=thread.id;
  insert into public.conversation_states(conversation_id,user_id,last_read_id) values(thread.id,p_actor,message.id) on conflict(conversation_id,user_id) do update set last_read_id=excluded.last_read_id;
 elsif p_action='read' then
  read_id:=least(thread.last_message_id,greatest(0,(p_input->>'lastRead')::bigint));
  insert into public.conversation_states(conversation_id,user_id,last_read_id) values(thread.id,p_actor,read_id) on conflict(conversation_id,user_id) do update set last_read_id=greatest(public.conversation_states.last_read_id,excluded.last_read_id);
 elsif p_action='status' then
  insert into public.conversation_states(conversation_id,user_id,status) values(thread.id,p_actor,p_input->>'status') on conflict(conversation_id,user_id) do update set status=excluded.status;
 else raise exception 'invalid_action';end if;
 return jsonb_build_object('thread',thread.id,'messageId',message.id);
end;$$;
revoke all on function public.change_conversation(uuid,text,jsonb) from public,anon,authenticated;grant execute on function public.change_conversation(uuid,text,jsonb) to service_role;
commit;
