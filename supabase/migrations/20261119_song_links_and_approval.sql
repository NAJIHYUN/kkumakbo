-- 2026-11-19: 곡별 난수 링크(slug) + 악보 업로드 관리자 승인 + 권한 보호
-- Supabase SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- 대시보드/SQL Editor(서비스 권한, auth.uid() = null)에서의 변경은 아래 보호 트리거의 제한을 받지 않습니다.

-- 0) 관리자 판별 헬퍼 -------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 1) profiles: 일반 사용자가 스스로 approved / role 을 바꾸지 못하게 ----------
-- (기존에는 profiles_update_own 정책 때문에 누구나 자기 role을 admin으로 바꿀 수 있었음)
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.approved := old.approved;
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
before update on public.profiles
for each row execute procedure public.guard_profile_privileges();

-- 2) songs.slug: 곡별 난수 링크 (song.html?s=<slug>) --------------------------
create or replace function public.random_slug(len int default 8)
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..len loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

alter table public.songs add column if not exists slug text;
update public.songs set slug = public.random_slug(8) where slug is null or slug = '';
alter table public.songs alter column slug set default public.random_slug(8);
alter table public.songs alter column slug set not null;
create unique index if not exists songs_slug_key on public.songs(slug);

-- 3) songs.status: 업로드 승인 ------------------------------------------------
-- 기존 악보는 모두 'approved'로 채워지고, 이후 새 업로드의 기본값은 'pending'.
alter table public.songs
  add column if not exists status text not null default 'approved';
alter table public.songs alter column status set default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'songs_status_check'
  ) then
    alter table public.songs
      add constraint songs_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- 관리자가 아니면: 새 업로드는 무조건 pending, 수정 시 status 변경 불가
create or replace function public.guard_song_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
  else
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists songs_guard_status on public.songs;
create trigger songs_guard_status
before insert or update on public.songs
for each row execute procedure public.guard_song_status();

create index if not exists songs_status_created_idx
on public.songs(status, created_at desc);

-- 4) songs RLS: 승인된 곡만 공개, 본인/관리자는 대기·반려 곡도 조회 ----------------
-- 대시보드에서 따로 만든(이름을 모르는) SELECT/UPDATE/DELETE 정책이 남아 있으면
-- 정책은 OR로 합쳐지기 때문에 승인 대기 악보가 공개될 수 있음 → 전부 지우고 아래에서 다시 만듦.
-- (INSERT 정책은 건드리지 않음)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'songs' and cmd in ('SELECT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.songs', pol.policyname);
  end loop;
end $$;

drop policy if exists "songs_select_all_public" on public.songs;
drop policy if exists "songs_select_visible" on public.songs;
create policy "songs_select_visible"
on public.songs for select
using (
  status = 'approved'
  or owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "songs_update_own" on public.songs;
drop policy if exists "songs_update_own_or_admin" on public.songs;
create policy "songs_update_own_or_admin"
on public.songs for update
to authenticated
using (auth.uid() = owner_id or public.is_admin())
with check (auth.uid() = owner_id or public.is_admin());

drop policy if exists "songs_delete_own" on public.songs;
drop policy if exists "songs_delete_own_or_admin" on public.songs;
create policy "songs_delete_own_or_admin"
on public.songs for delete
to authenticated
using (auth.uid() = owner_id or public.is_admin());

-- 5) 비로그인 악보 업로드 (Supabase 익명 로그인 사용) ---------------------------
-- 앱은 비로그인 사용자가 악보를 올릴 때만 잠깐 익명 세션을 만들고, 업로드 후 바로 로그아웃합니다.
-- 익명 사용자도 위 규칙을 그대로 따르므로 업로드는 항상 'pending'(승인 대기)입니다.
-- 사용하려면 대시보드 Authentication > Sign In / Providers 에서 "Allow anonymous sign-ins"를 켜세요.
-- ⚠️ 반드시 이 SQL을 먼저 실행한 뒤에 켜세요. (트리거가 없으면 익명 업로드가 바로 공개됩니다)

-- 익명 사용자는 profiles 행을 만들지 않음 (회원 목록이 익명 계정으로 채워지지 않게)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
