-- 20261119_song_links_and_approval.sql 되돌리기 (문제가 생겼을 때만 SQL Editor에서 실행)
-- 데이터(악보 행)는 지우지 않습니다. slug/status 컬럼은 남겨둬도 이전 앱은 무시하므로 기본으로는 그대로 둡니다.

-- 트리거 제거
drop trigger if exists songs_guard_status on public.songs;
drop trigger if exists profiles_guard_privileges on public.profiles;

-- songs 정책을 이전(schema.sql) 상태로
drop policy if exists "songs_select_visible" on public.songs;
drop policy if exists "songs_update_own_or_admin" on public.songs;
drop policy if exists "songs_delete_own_or_admin" on public.songs;

create policy "songs_select_all_public" on public.songs for select using (true);
create policy "songs_update_own" on public.songs for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "songs_delete_own" on public.songs for delete to authenticated
  using (auth.uid() = owner_id);

-- 새 업로드 기본값을 다시 공개로
alter table public.songs alter column status set default 'approved';

-- 익명 계정 profiles 제외 조건 되돌리기
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;

-- (선택) 컬럼까지 완전히 제거하려면:
-- alter table public.songs drop column if exists slug;
-- alter table public.songs drop column if exists status;
