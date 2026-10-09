-- Проверка RLS. Запускать целиком (execute_sql в MCP или SQL Editor).
-- Ожидаемый результат: одна строка 'rls ok'. Все изменения откатываются.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'musician@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'outsider@test.local');
insert into public.members (user_id, role, email) values ('00000000-0000-0000-0000-0000000000a1', 'owner', 'owner@test.local');
insert into public.positions (id, name) values ('00000000-0000-0000-0000-0000000000d4', 'Труба 1');
insert into public.pieces (id, title) values ('00000000-0000-0000-0000-0000000000e5', 'Тест');
insert into storage.objects (bucket_id, name) values ('scores', '00000000-0000-0000-0000-0000000000e5/x.pdf');
select set_config('test.token', (select invite_token::text from public.band), true);

set local role authenticated;

-- Посторонний: ничего не видит и не вступает по чужому токену
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.pieces) = 0, 'посторонний видит pieces';
  assert (select count(*) from public.positions) = 0, 'посторонний видит positions';
  assert (select count(*) from storage.objects where bucket_id = 'scores') = 0, 'посторонний видит файлы';
  begin
    perform public.join_band(gen_random_uuid());
    raise exception 'FAIL: вступил по неверному токену';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Музыкант вступает по ссылке, в том числе повторно
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select public.join_band(current_setting('test.token')::uuid);
select public.join_band(current_setting('test.token')::uuid);
do $$ begin
  assert (select role from public.members where user_id = auth.uid()) = 'musician', 'не стал музыкантом';
  assert (select email from public.members where user_id = auth.uid()) = 'musician@test.local', 'email не записан';
  assert (select count(*) from public.pieces) = 1, 'музыкант не видит pieces';
  assert (select count(*) from storage.objects where bucket_id = 'scores') = 1, 'музыкант не видит файлы';
  assert (select count(*) from public.band) = 0, 'музыкант видит band с токеном';
  update public.members set position_id = '00000000-0000-0000-0000-0000000000d4' where user_id = auth.uid();
  assert (select position_id from public.members where user_id = auth.uid()) is not null, 'не смог выбрать инструмент';
  begin
    update public.members set role = 'owner' where user_id = auth.uid();
    raise exception 'FAIL: музыкант сменил себе роль';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pieces (title) values ('взлом');
    raise exception 'FAIL: музыкант создал пьесу';
  exception when insufficient_privilege then null;
  end;
  update public.pieces set title = 'взлом';
  assert (select title from public.pieces) = 'Тест', 'музыкант изменил пьесу';
  begin
    insert into storage.objects (bucket_id, name) values ('scores', 'evil.pdf');
    raise exception 'FAIL: музыкант загрузил файл';
  exception when insufficient_privilege then null;
  end;
  update public.members set display_name = 'x' where user_id = '00000000-0000-0000-0000-0000000000a1';
  assert (select display_name from public.members where user_id = '00000000-0000-0000-0000-0000000000a1') is null,
    'музыкант изменил чужую строку';
end $$;

-- Владелец: не понижается по ссылке, видит токен, пишет, удаляет позицию и участника, но не себя
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.join_band(current_setting('test.token')::uuid);
do $$ begin
  assert (select role from public.members where user_id = auth.uid()) = 'owner', 'владелец понижен до музыканта';
  assert (select count(*) from public.band) = 1, 'владелец не видит band';
  assert (select count(*) from public.members) = 2, 'посторонний попал в участники';
  insert into public.pieces (title) values ('Новая');
  assert (select count(*) from public.pieces) = 2, 'владелец не создал пьесу';
  delete from public.positions where id = '00000000-0000-0000-0000-0000000000d4';
  assert (select position_id from public.members where user_id = '00000000-0000-0000-0000-0000000000b2') is null,
    'после удаления позиции у музыканта остался инструмент';
  delete from public.members where user_id = auth.uid();
  assert exists (select 1 from public.members where user_id = auth.uid()), 'владелец удалил сам себя';
  delete from public.members where user_id = '00000000-0000-0000-0000-0000000000b2';
  assert not exists (select 1 from public.members where user_id = '00000000-0000-0000-0000-0000000000b2'),
    'владелец не удалил участника';
end $$;

select 'rls ok';
rollback;
