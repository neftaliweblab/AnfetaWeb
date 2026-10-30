begin;
alter table public.profiles drop constraint if exists profiles_person_tag_check;
alter table public.profiles add constraint profiles_person_tag_check check (person_tag in ('jjohn','nneft','kkarl','iisai','ssote','aacal','aandr','bbria','ggena','eemma','eedwin'));
commit;
