/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 *
 * 로그인 / 회원가입: 닉네임 + 숫자 6자리 (이메일 수집 안 함)
 *   로그인:   닉네임 → 숫자 6자리 → 자동 로그인
 *   회원가입: 닉네임 → 숫자 6자리 → 한 번 더 → 가입 (관리자 승인 후 이용)
 */
const $ = (s) => document.querySelector(s);
const A = window.KkumAccount;

function nextPath() {
  const n = new URL(location.href).searchParams.get("next") || "./index.html";
  // 다른 사이트로 보내는 링크 방지
  try {
    const url = new URL(n, location.href);
    if (url.origin !== location.origin) return "./index.html";
  } catch {
    return "./index.html";
  }
  return n;
}

function requestedMode() {
  const mode = String(new URL(location.href).searchParams.get("mode") || "").toLowerCase();
  return mode === "signup" ? "signup" : "signin";
}

async function getMyProfile(client, userId) {
  const { data, error } = await client.from("profiles").select("id, approved, role").eq("id", userId).maybeSingle();
  if (error) return null;
  return data || null;
}

function setupContactAdmin(client) {
  const btn = $("#btnContactAdmin");
  const messageEl = $("#contactMessage");
  const status = $("#contactStatus");
  if (!btn || !messageEl) return;
  btn.addEventListener("click", async () => {
    const message = String(messageEl.value || "").trim();
    if (!message) {
      status.textContent = "문의 내용을 입력해 주세요.";
      return;
    }
    btn.disabled = true;
    try {
      const { error } = await client.from("contact_messages").insert({
        message,
        nickname: A.normalizeNickname($("#authNickname")?.value || "") || null,
        email: null,
        role: null,
        mode: "pin",
        source: "auth",
      });
      status.textContent = error ? "문의 전송에 실패했어요. 잠시 후 다시 시도해 주세요." : "문의가 전송되었어요.";
      if (!error) messageEl.value = "";
    } catch {
      status.textContent = "문의 전송 중 오류가 발생했어요.";
    } finally {
      btn.disabled = false;
    }
  });
}

async function initAuth() {
  if (!window.SB?.isConfigured() || !A) return;
  const client = window.SB.getClient();
  if (!client) return;

  // 이미 로그인돼 있으면 바로 이동
  const { data } = await client.auth.getSession();
  const current = data?.session || null;
  if (current && !current.user?.is_anonymous) {
    const profile = await getMyProfile(client, current.user.id);
    if (!profile || profile.approved !== false) {
      location.replace(nextPath());
      return;
    }
    await client.auth.signOut({ scope: "local" });
  }

  const nicknameForm = $("#stepNickname");
  const nicknameInput = $("#authNickname");
  const nicknameStatus = $("#nicknameStatus");
  const stepPin = $("#stepPin");
  const stepDone = $("#stepDone");
  const dots = Array.from(document.querySelectorAll("#pinDots span"));
  const dotsWrap = $("#pinDots");
  const status = $("#authStatus");
  const title = $("#authTitle");
  const desc = $("#authDesc");
  const switchBtn = $("#btnSwitchMode");

  let mode = requestedMode(); // signin | signup
  let step = "nickname"; // nickname | pin | confirm | done
  let pin = "";
  let firstPin = "";
  let busy = false;

  function render() {
    const isSignup = mode === "signup";
    title.textContent = isSignup ? "회원가입" : "로그인";
    if (step === "nickname") {
      desc.textContent = isSignup ? "사용할 닉네임을 정해주세요. 한글·영문·숫자 10자 이내예요." : "닉네임을 입력해 주세요.";
    } else if (step === "pin") {
      desc.textContent = isSignup ? `${nickname()}님, 비밀번호로 쓸 숫자 6자리를 눌러주세요.` : `${nickname()}님, 비밀번호 숫자 6자리를 눌러주세요.`;
    } else if (step === "confirm") {
      desc.textContent = "확인을 위해 한 번 더 눌러주세요.";
    }
    nicknameForm.classList.toggle("hidden", step !== "nickname");
    stepPin.classList.toggle("hidden", step !== "pin" && step !== "confirm");
    stepDone.classList.toggle("hidden", step !== "done");
    switchBtn.classList.toggle("hidden", step === "done");
    switchBtn.innerHTML = isSignup ? "이미 계정이 있나요? <strong>로그인</strong>" : "처음이신가요? <strong>회원가입</strong>";
    document.title = `${isSignup ? "회원가입" : "로그인"} · 꿈꾸는교회 악보함`;
    renderDots();
  }

  function renderDots() {
    dots.forEach((dot, i) => dot.classList.toggle("is-filled", i < pin.length));
    dotsWrap.setAttribute("aria-label", `비밀번호 ${pin.length}자리 입력됨`);
  }

  function nickname() {
    return A.normalizeNickname(nicknameInput.value);
  }

  function fail(message) {
    status.textContent = message;
    pin = "";
    renderDots();
    dotsWrap.classList.remove("is-shake");
    void dotsWrap.offsetWidth;
    dotsWrap.classList.add("is-shake");
    if (navigator.vibrate) navigator.vibrate(60);
  }

  function goStep(next) {
    step = next;
    pin = "";
    status.textContent = "";
    nicknameStatus.textContent = "";
    render();
    if (next === "nickname") nicknameInput.focus();
  }

  function setMode(next) {
    mode = next;
    firstPin = "";
    const url = new URL(location.href);
    url.searchParams.set("mode", next);
    history.replaceState({}, "", url);
    goStep("nickname");
  }

  async function submitSignIn() {
    busy = true;
    status.textContent = "확인 중…";
    try {
      const { data: res, error } = await client.auth.signInWithPassword({
        email: A.nicknameToEmail(nickname()),
        password: pin,
      });
      if (error || !res?.session) {
        fail("닉네임 또는 비밀번호가 맞지 않아요.");
        return;
      }
      const profile = await getMyProfile(client, res.session.user.id);
      if (profile && profile.approved === false) {
        await client.auth.signOut({ scope: "local" });
        fail("아직 관리자 승인 전이에요. 승인 후 로그인할 수 있어요.");
        return;
      }
      status.textContent = "";
      location.replace(nextPath());
    } finally {
      busy = false;
    }
  }

  async function submitSignUp() {
    busy = true;
    status.textContent = "가입 중…";
    try {
      const { data: res, error } = await client.auth.signUp({
        email: A.nicknameToEmail(nickname()),
        password: pin,
        options: { data: { nickname: nickname() } },
      });
      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("already") || error.status === 422) {
          goStep("nickname");
          nicknameStatus.textContent = "이미 사용 중인 닉네임이에요. 다른 닉네임을 써주세요.";
          return;
        }
        if (msg.includes("password")) {
          fail("이 비밀번호는 쓸 수 없어요. 다른 숫자 6자리를 눌러주세요.");
          firstPin = "";
          step = "pin";
          render();
          return;
        }
        fail("가입에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      // 이미 있는 닉네임이면 Supabase가 오류 대신 빈 identities를 돌려줄 때가 있음
      if (res?.user && Array.isArray(res.user.identities) && res.user.identities.length === 0) {
        goStep("nickname");
        nicknameStatus.textContent = "이미 사용 중인 닉네임이에요. 다른 닉네임을 써주세요.";
        return;
      }
      if (res?.session) await client.auth.signOut({ scope: "local" });
      step = "done";
      $("#authNotice").textContent = `${nickname()}님, 가입이 완료됐어요! 관리자 승인 후 로그인할 수 있어요. 비밀번호 숫자 6자리는 꼭 기억해 주세요.`;
      title.textContent = "가입 완료";
      desc.textContent = "";
      render();
    } finally {
      busy = false;
    }
  }

  function pressKey(key) {
    if (busy || (step !== "pin" && step !== "confirm")) return;
    if (key === "back") {
      pin = pin.slice(0, -1);
      status.textContent = "";
      renderDots();
      return;
    }
    if (!/^\d$/.test(key) || pin.length >= A.PIN_LENGTH) return;
    pin += key;
    renderDots();
    if (pin.length < A.PIN_LENGTH) return;

    // 6자리 완성 → 다음 동작 (점이 다 찬 걸 잠깐 보여준 뒤)
    setTimeout(() => {
      if (mode === "signin") {
        submitSignIn();
      } else if (step === "pin") {
        firstPin = pin;
        step = "confirm";
        pin = "";
        status.textContent = "";
        render();
      } else if (pin !== firstPin) {
        firstPin = "";
        step = "pin";
        render();
        fail("두 번 입력한 숫자가 달라요. 처음부터 다시 눌러주세요.");
      } else {
        submitSignUp();
      }
    }, 120);
  }

  nicknameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = A.validateNickname(nicknameInput.value);
    if (err) {
      nicknameStatus.textContent = err;
      nicknameInput.focus();
      return;
    }
    nicknameInput.value = nickname();
    goStep("pin");
  });
  nicknameInput.addEventListener("input", () => { nicknameStatus.textContent = ""; });

  // 키패드: 누르는 순간 반응
  document.querySelectorAll(".pin-keypad button").forEach((btn) => {
    btn.addEventListener("click", () => pressKey(btn.dataset.key));
  });
  // 실제 키보드(데스크탑)도 지원
  document.addEventListener("keydown", (e) => {
    if (step !== "pin" && step !== "confirm") return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); pressKey(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); pressKey("back"); }
    else if (e.key === "Escape") { e.preventDefault(); goStep("nickname"); }
  });

  $("#btnAuthBack").addEventListener("click", () => {
    if (step === "confirm") { firstPin = ""; goStep("pin"); return; }
    if (step === "pin") { goStep("nickname"); return; }
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.href = "./index.html";
  });
  switchBtn.addEventListener("click", () => setMode(mode === "signup" ? "signin" : "signup"));

  setupContactAdmin(client);
  render();
  nicknameInput.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  initAuth().catch((err) => {
    console.error(err);
    const s = document.querySelector("#nicknameStatus");
    if (s) s.textContent = "로그인 화면을 불러오지 못했어요. 새로고침해 주세요.";
  });
});
