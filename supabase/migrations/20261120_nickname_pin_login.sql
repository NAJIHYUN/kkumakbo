-- 2026-11-20: 닉네임 + 숫자 6자리 로그인, 이메일 수집 중단
--
-- 로그인 방식
--   Supabase Auth는 계정마다 이메일이 필요해서, 앱이 닉네임으로 내부 전용 주소를 만들어 씁니다.
--   (예: u<닉네임을 16진수로 바꾼 값>@kkumakbo.invalid — .invalid는 메일이 절대 가지 않는 예약 도메인)
--   사용자에게 이메일을 묻거나 저장하지 않습니다.
--
-- 이 SQL이 하는 일
--   1) profiles.nickname 추가 (+ 기존 회원 닉네임 채우기) — 관리자가 누구인지 알아볼 수 있게
--   2) profiles.email 비우기 + 새 가입 때 이메일 저장 안 함
--   3) 관리자는 모든 profiles 조회/수정 가능 (승인 페이지에서 가입 승인)

-- 1) 닉네임 컬럼
alter table public.profiles add column if not exists nickname text not null default '';

update public.profiles p
set nickname = coalesce(nullif(trim(u.raw_user_meta_data->>'nickname'), ''), p.nickname)
from auth.users u
where u.id = p.id and (p.nickname = '' or p.nickname is null);

-- 2) 이메일 수집 중단
update public.profiles set email = '' where coalesce(email, '') <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 익명(비로그인 업로드용) 계정은 회원 목록에 넣지 않음
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.profiles (id, email, nickname)
  values (new.id, '', coalesce(trim(new.raw_user_meta_data->>'nickname'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) 관리자: 전체 회원 조회/수정 (가입 승인)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
