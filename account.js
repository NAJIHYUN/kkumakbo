/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 *
 * 닉네임 + 숫자 6자리 계정 규칙 (가입 · 로그인 · MY · 관리자 스크립트가 같이 씀)
 *
 * Supabase Auth는 계정마다 이메일이 필요해서, 닉네임으로 내부 전용 주소를 만든다.
 *   닉네임 → 소문자 → UTF-8 바이트 → 16진수 → "u<16진수>@kkumakbo.invalid"
 * .invalid는 메일이 절대 가지 않는 예약 도메인이라 실제 이메일을 묻거나 저장하지 않는다.
 * 영문 닉네임은 대소문자를 구분하지 않는다 (Emily = emily).
 */
(function (root) {
  const DOMAIN = "kkumakbo.invalid";
  const NICKNAME_MAX = 10;
  const PIN_LENGTH = 6;

  function normalizeNickname(nickname = "") {
    return String(nickname).normalize("NFC").trim();
  }

  function nicknameToEmail(nickname = "") {
    const key = normalizeNickname(nickname).toLowerCase();
    const bytes = new TextEncoder().encode(key);
    let hex = "";
    bytes.forEach((b) => { hex += b.toString(16).padStart(2, "0"); });
    return `u${hex}@${DOMAIN}`;
  }

  function isInternalEmail(email = "") {
    return String(email).toLowerCase().endsWith(`@${DOMAIN}`);
  }

  function validateNickname(nickname = "") {
    const value = normalizeNickname(nickname);
    if (!value) return "닉네임을 입력해 주세요.";
    if (Array.from(value).length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이내로 입력해 주세요.`;
    if (!/^[A-Za-z0-9가-힣]+$/.test(value)) return "닉네임은 한글·영문·숫자만 쓸 수 있어요. (띄어쓰기 X)";
    return "";
  }

  function validatePin(pin = "") {
    const value = String(pin);
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value)) return `비밀번호는 숫자 ${PIN_LENGTH}자리예요.`;
    return "";
  }

  const api = { DOMAIN, NICKNAME_MAX, PIN_LENGTH, normalizeNickname, nicknameToEmail, isInternalEmail, validateNickname, validatePin };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KkumAccount = api;
})(typeof window !== "undefined" ? window : globalThis);
