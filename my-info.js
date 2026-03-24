/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 */
const $ = (s) => document.querySelector(s);
const KOR_INITIALS = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"
];

let myInfoPasswordUpdating = false;
const UI_THEME_STORAGE_KEY = "scorebox-ui-theme";

function normalize(str = "") {
  return String(str).normalize("NFC").trim().toLowerCase();
}

function getChosung(str = "") {
  const text = String(str).normalize("NFC");
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = Math.floor((code - 0xac00) / (21 * 28));
      out += KOR_INITIALS[idx] || "";
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
    }
  }
  return out;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function setMyInfoStatus(message = "", isError = false) {
  const el = $("#myInfoStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

function validateMyInfoPassword(password = "") {
  const value = String(password || "");
  if (!value) return "새 비밀번호를 입력해 주세요.";
  if (value.length < 5 || value.length > 15) return "비밀번호는 5~15자로 입력해 주세요.";
  if (!/^[A-Za-z0-9!@#]+$/.test(value)) return "비밀번호는 영문/숫자/!@#만 사용할 수 있어요.";
  return "";
}

function matchesSongsQuery(item, query) {
  const q = normalize(query);
  if (!q) return true;
  const title = normalize(item?.title || "");
  const artist = normalize(item?.artist || "");
  const key = normalize(item?.key || "");
  const merged = `${title} ${artist} ${key}`.trim();
  if (/[ㄱ-ㅎ]/.test(q)) {
    return `${getChosung(title)}${getChosung(artist)}`.includes(q.replace(/\s+/g, ""));
  }
  return title.includes(q) || artist.includes(q) || key.includes(q) || merged.includes(q);
}

function getVaultLabel(vault = "") {
  const v = String(vault || "").toLowerCase();
  if (v === "high") return "고등부";
  if (v === "middle") return "중등부";
  return "기타";
}

function normalizeVaultKey(vault = "") {
  const v = String(vault || "").toLowerCase();
  if (v === "high" || v === "middle" || v === "all") return v;
  return "all";
}

function getRoleLabel(role = "") {
  const value = String(role || "").toLowerCase();
  if (value === "admin") return "관리자";
  if (value === "high") return "고등부";
  if (value === "middle") return "중등부";
  if (value === "all") return "기타";
  return "-";
}

function getStoredTheme() {
  if (window.ScoreboxTheme?.getStoredTheme) {
    return window.ScoreboxTheme.getStoredTheme();
  }
  try {
    const value = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyUiTheme(theme = "light") {
  const nextTheme = theme === "dark" ? "dark" : "light";
  if (window.ScoreboxTheme?.apply) {
    window.ScoreboxTheme.apply(nextTheme);
  } else {
    document.documentElement.dataset.uiTheme = nextTheme;
    document.body.dataset.uiTheme = nextTheme;
  }

  const toggleBtn = $("#btnThemeToggle");
  const label = $("#themeToggleLabel");
  if (toggleBtn) {
    const isDark = nextTheme === "dark";
    toggleBtn.classList.toggle("is-dark", isDark);
    toggleBtn.setAttribute("aria-pressed", String(isDark));
    toggleBtn.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  }
  if (label) {
    label.textContent = nextTheme === "dark" ? "다크" : "라이트";
  }
}

function saveUiTheme(theme = "light") {
  if (window.ScoreboxTheme?.set) {
    window.ScoreboxTheme.set(theme);
    return;
  }
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme === "dark" ? "dark" : "light");
  } catch {}
}

function buildAuthPageUrl() {
  const next = `${location.pathname}${location.search}`;
  return `./auth.html?next=${encodeURIComponent(next)}`;
}

function buildAuthModeUrl(mode = "") {
  const base = new URL(buildAuthPageUrl(), location.href);
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "signin" || normalized === "signup") {
    base.searchParams.set("mode", normalized);
  }
  return base.toString();
}

function setGuestMode() {
  const loginUrl = buildAuthModeUrl("signin");
  const signupUrl = buildAuthModeUrl("signup");
  const infoForm = document.querySelector(".package-form.myinfo-form");
  const guestActions = $("#myInfoGuestActions");
  [
    "#myInfoLineNickname",
    "#myInfoLineEmail",
    "#myInfoLineRole",
    "#myInfoLinePassword",
    "#myInfoLinePasswordConfirm",
    ".myinfo-actions",
    "#myInfoStatus",
    "#myInfoPackagesSection",
  ].forEach((selector) => {
    document.querySelector(selector)?.classList.add("hidden");
  });
  $("#myInfoPageTitle").textContent = "MY";
  $("#myInfoPackagesTitle").textContent = "나의 악보";
  document.title = "MY";
  infoForm?.classList.add("hidden");
  guestActions?.classList.remove("hidden");

  $("#btnMyInfoGuestLogin")?.addEventListener("click", () => {
    location.href = loginUrl;
  });
  $("#btnMyInfoGuestSignup")?.addEventListener("click", () => {
    location.href = signupUrl;
  });

  const searchInput = $("#myPackagesSearch");
  const clearBtn = $("#btnClearMyPackagesSearch");
  if (searchInput) {
    searchInput.value = "";
    searchInput.disabled = true;
    searchInput.placeholder = "로그인 후 검색할 수 있습니다.";
  }
  clearBtn?.classList.add("hidden");
  setMyInfoStatus("");
}

async function loadMySongs(userId = "") {
  const client = window.SB?.getClient?.();
  if (!client || !userId) return [];
  try {
    let data;
    let error;
    ({ data, error } = await client
      .from("songs")
      .select("id, title, artist, key, pdf_url, jpg_url, created_at, owner_id, uploader_nickname")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }));
    if (error) {
      ({ data, error } = await client
        .from("songs")
        .select("id, title, artist, key, pdf_url, jpg_url, created_at, owner_id")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }));
    }
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.id,
      title: row.title || "이름 없는 악보",
      artist: row.artist || "",
      key: row.key || "",
      pdfUrl: row.pdf_url || "",
      jpgUrl: row.jpg_url || "",
      createdAt: row.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.error("my songs 로드 오류:", err);
    return [];
  }
}

function getSongOpenUrl(item) {
  return String(item?.pdfUrl || item?.jpgUrl || "").trim();
}

async function renderSongs(userId, query = "") {
  const list = $("#myPackagesList");
  if (!list) return;
  const items = (await loadMySongs(userId)).filter((item) => matchesSongsQuery(item, query));

  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "vault-empty";
    empty.textContent = "업로드한 악보가 없습니다.";
    list.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "vault-item";

    const meta = document.createElement("div");
    meta.className = "vault-item-meta";

    const name = document.createElement("div");
    name.className = "vault-item-name";

    const songTitleEl = document.createElement("span");
    songTitleEl.className = "vault-package-name";
    songTitleEl.textContent = item.title;

    const artistEl = document.createElement("span");
    artistEl.className = "vault-item-nickname vault-label-all";
    const artistText = item.artist || "-";
    const keyText = item.key ? `${item.key}키` : "-";
    artistEl.textContent = `${artistText}ㆍ${keyText}`;

    name.append(songTitleEl, artistEl);

    const date = document.createElement("div");
    date.className = "vault-item-date";
    date.textContent = formatDate(item.createdAt);
    meta.append(name, date);

    const actions = document.createElement("div");
    actions.className = "vault-item-actions";

    const openUrl = getSongOpenUrl(item);
    const openBtn = document.createElement("button");
    openBtn.className = "btn vault-btn-open";
    openBtn.textContent = "열기";
    openBtn.disabled = !openUrl;
    openBtn.addEventListener("click", () => {
      if (!openUrl) return;
      window.open(openUrl, "_blank");
    });

    actions.append(openBtn);
    row.append(meta, actions);
    list.appendChild(row);
  });
}

async function init() {
  applyUiTheme(getStoredTheme());
  $("#btnThemeToggle")?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.uiTheme === "dark" ? "light" : "dark";
    applyUiTheme(nextTheme);
    saveUiTheme(nextTheme);
  });

  if (!window.SB?.isConfigured()) {
    setGuestMode();
    return;
  }
  const client = window.SB.getClient();
  if (!client) {
    setGuestMode();
    return;
  }

  const { data } = await client.auth.getSession();
  const session = data?.session || null;
  if (!session) {
    setGuestMode();
    return;
  }

  const nickname = String(
    session.user?.user_metadata?.nickname ||
    session.user?.email?.split("@")[0] ||
    "-"
  );
  const email = String(session.user?.email || "-");
  const userId = String(session.user?.id || "");
  const pageTitle = nickname && nickname !== "-" ? `${nickname}님의 정보` : "나의 정보";
  const packagesTitle = nickname && nickname !== "-" ? `${nickname}님의 악보` : "나의 악보";

  $("#myInfoPageTitle").textContent = pageTitle;
  $("#myInfoPackagesTitle").textContent = packagesTitle;
  document.title = pageTitle;
  $("#myInfoNickname").textContent = nickname;
  $("#myInfoEmail").textContent = email;

  try {
    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    $("#myInfoRole").textContent = getRoleLabel(profile?.role);
  } catch {
    $("#myInfoRole").textContent = "-";
  }

  $("#btnMyInfoChangePassword")?.addEventListener("click", async () => {
    if (myInfoPasswordUpdating) return;
    const pw = String($("#myInfoNewPassword")?.value || "");
    const pw2 = String($("#myInfoNewPasswordConfirm")?.value || "");
    const pwErr = validateMyInfoPassword(pw);
    if (pwErr) {
      setMyInfoStatus(pwErr, true);
      return;
    }
    if (!pw2) {
      setMyInfoStatus("비밀번호 확인을 입력해 주세요.", true);
      return;
    }
    if (pw !== pw2) {
      setMyInfoStatus("비밀번호와 비밀번호 확인이 일치하지 않습니다.", true);
      return;
    }

    myInfoPasswordUpdating = true;
    setMyInfoStatus("비밀번호 변경 중...");
    try {
      const { error } = await client.auth.updateUser({ password: pw });
      if (error) {
        setMyInfoStatus(error.message || "비밀번호 변경에 실패했습니다.", true);
        return;
      }
      $("#myInfoNewPassword").value = "";
      $("#myInfoNewPasswordConfirm").value = "";
      setMyInfoStatus("비밀번호가 변경되었습니다.");
    } catch (err) {
      console.error(err);
      setMyInfoStatus("비밀번호 변경 중 오류가 발생했습니다.", true);
    } finally {
      myInfoPasswordUpdating = false;
    }
  });

  $("#btnMyInfoLogout")?.addEventListener("click", async () => {
    const ok = confirm("로그아웃 하시겠습니까?");
    if (!ok) return;
    try {
      await client.auth.signOut();
    } catch {}
    location.replace("./my-info.html");
  });

  const searchInput = $("#myPackagesSearch");
  const clearBtn = $("#btnClearMyPackagesSearch");
  const syncClear = () => {
    const has = (searchInput?.value || "").trim().length > 0;
    clearBtn?.classList.toggle("hidden", !has);
  };

  searchInput?.addEventListener("input", async () => {
    syncClear();
    await renderSongs(userId, searchInput.value || "");
  });
  clearBtn?.addEventListener("click", async () => {
    if (!searchInput) return;
    searchInput.value = "";
    syncClear();
    searchInput.focus();
    await renderSongs(userId, "");
  });

  syncClear();
  await renderSongs(userId, "");
}

init().catch((err) => {
  console.error("my info page 초기화 실패:", err);
  setMyInfoStatus("나의 정보를 불러오는 중 오류가 발생했습니다.", true);
});
