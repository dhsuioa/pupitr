-- Проверки членства нужны только вошедшим: политики RLS объявлены для authenticated.
revoke execute on function public.is_member(), public.is_owner() from public, anon;
grant execute on function public.is_member(), public.is_owner() to authenticated;
