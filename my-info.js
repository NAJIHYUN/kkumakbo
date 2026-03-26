/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 */
const $ = (s) => document.querySelector(s);
const KOR_INITIALS = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"
];
const ANIMAL_EMOJIS = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐯", "🦁", "🐨", "🐷", "🐹", "🐵"];
const EMOJI_GROUPS = [
  { label: "동물", items: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐵","🐔","🐧","🐤","🦄","🐙","🦋","🐥"] },
  { label: "표정", items: ["😀","😃","😄","😁","😆","🥹","😊","😍","🥰","😘","😎","🤩","🥳","🙂","🤗","🤔","🥲","😭","😤","😴","😇"] },
  { label: "하트", items: ["❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤍","🖤","🤎","💘","💝","💖","💗","💓","💕","💞","💟","❣️","💌"] },
  { label: "사물", items: ["🎵","🎶","🎼","🎤","🎧","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🪇","📯"] },
  { label: "음식", items: ["🍎","🍓","🍇","🍊","🍋","🍉","🍒","🥝","🍅","🥑","🍞","🍔","🍕","🍗","🍟","🍩","🍪","🎂","☕","🧃","🍜"] },
];

let myInfoPasswordUpdating = false;
let myInfoAvatarUpdating = false;
let myInfoAvatarBgUpdating = false;
let myInfoAvatarBgColorDraft = "#eef3ff";
let myInfoAvatarBgDragging = false;
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

function getStableAnimalEmoji(seed = "") {
  const source = String(seed || "").trim();
  if (!source) return "🐶";
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return ANIMAL_EMOJIS[hash % ANIMAL_EMOJIS.length] || "🐶";
}

function getMyInfoAvatarValue(savedEmoji = "", seed = "") {
  const emoji = String(savedEmoji || "").trim();
  if (emoji) return emoji;
  return getStableAnimalEmoji(seed);
}

function normalizeAvatarBgColor(value = "") {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#eef3ff";
}

function hslToHex(h, s, l) {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex = "") {
  const normalized = normalizeAvatarBgColor(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function setMyInfoAvatar(savedEmoji = "", seed = "", bgColor = "") {
  const avatar = $("#myInfoAvatarButton");
  if (!avatar) return;
  avatar.textContent = getMyInfoAvatarValue(savedEmoji, seed);
  avatar.style.background = normalizeAvatarBgColor(bgColor);
}

function setMyInfoAvatarBgPreview(savedEmoji = "", seed = "", bgColor = "") {
  const preview = $("#myInfoAvatarBgPreview");
  if (!preview) return;
  preview.textContent = getMyInfoAvatarValue(savedEmoji, seed);
  preview.style.background = normalizeAvatarBgColor(bgColor);
}

function drawMyInfoAvatarBgWheel() {
  const canvas = $("#myInfoAvatarBgWheel");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const hueGradient = ctx.createLinearGradient(0, 0, width, 0);
  hueGradient.addColorStop(0, "#ff0000");
  hueGradient.addColorStop(1 / 6, "#ffff00");
  hueGradient.addColorStop(2 / 6, "#00ff00");
  hueGradient.addColorStop(3 / 6, "#00ffff");
  hueGradient.addColorStop(4 / 6, "#0000ff");
  hueGradient.addColorStop(5 / 6, "#ff00ff");
  hueGradient.addColorStop(1, "#ff0000");
  ctx.fillStyle = hueGradient;
  ctx.fillRect(0, 0, width, height);

  const whiteGradient = ctx.createLinearGradient(0, 0, 0, height);
  whiteGradient.addColorStop(0, "rgba(255,255,255,0.88)");
  whiteGradient.addColorStop(0.42, "rgba(255,255,255,0)");
  whiteGradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = whiteGradient;
  ctx.fillRect(0, 0, width, height);

  const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
  blackGradient.addColorStop(0, "rgba(0,0,0,0)");
  blackGradient.addColorStop(1, "rgba(0,0,0,0.96)");
  ctx.fillStyle = blackGradient;
  ctx.fillRect(0, 0, width, height);

  updateMyInfoAvatarBgMarker();
}

function updateMyInfoAvatarBgMarker() {
  const canvas = $("#myInfoAvatarBgWheel");
  const marker = $("#myInfoAvatarBgMarker");
  if (!(canvas instanceof HTMLCanvasElement) || !(marker instanceof HTMLElement)) return;
  const rect = canvas.getBoundingClientRect();
  const { h, l } = hexToHsl(myInfoAvatarBgColorDraft);
  const x = (h / 360) * rect.width;
  const y = ((100 - l) / 100) * rect.height;
  marker.style.left = `${Math.max(0, Math.min(rect.width, x))}px`;
  marker.style.top = `${Math.max(0, Math.min(rect.height, y))}px`;
  marker.style.background = normalizeAvatarBgColor(myInfoAvatarBgColorDraft);
}

function pickMyInfoAvatarBgColorFromWheel(event) {
  const canvas = $("#myInfoAvatarBgWheel");
  if (!(canvas instanceof HTMLCanvasElement)) return "";
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  if (!pixel || pixel[3] === 0) return "";
  return normalizeAvatarBgColor(
    `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, "0")).join("")}`,
  );
}

function handleMyInfoAvatarBgPointer(event, savedEmoji = "", seed = "") {
  const color = pickMyInfoAvatarBgColorFromWheel(event);
  if (!color) return;
  myInfoAvatarBgColorDraft = color;
  setMyInfoAvatarBgPreview(savedEmoji, seed, myInfoAvatarBgColorDraft);
  updateMyInfoAvatarBgMarker();
}

function setMyInfoSummary(nickname = "-", email = "-") {
  const nicknameEl = $("#myInfoSummaryNickname");
  const emailEl = $("#myInfoSummaryEmail");
  if (nicknameEl) nicknameEl.textContent = nickname || "-";
  if (emailEl) emailEl.textContent = email || "-";
}

function setMyInfoEmojiModal(open) {
  const modal = $("#myInfoEmojiModal");
  if (!modal) return;
  modal.classList.toggle("hidden", !open);
  if (open) drawMyInfoAvatarBgWheel();
}

function setMyInfoEmojiTab(tab = "emoji") {
  const isBg = tab === "bg";
  $("#myInfoEmojiTab")?.classList.toggle("is-active", !isBg);
  $("#myInfoAvatarBgTab")?.classList.toggle("is-active", isBg);
  $("#myInfoEmojiPicker")?.classList.toggle("hidden", isBg);
  $("#myInfoAvatarBgPane")?.classList.toggle("hidden", !isBg);
}

function renderMyInfoEmojiPicker(selectedEmoji = "", onSelect = () => {}) {
  const picker = $("#myInfoEmojiPicker");
  if (!picker) return;
  picker.innerHTML = "";
  EMOJI_GROUPS.forEach((group) => {
    const section = document.createElement("section");
    section.className = "myinfo-emoji-group";

    const title = document.createElement("strong");
    title.className = "myinfo-emoji-group-title";
    title.textContent = group.label;

    const grid = document.createElement("div");
    grid.className = "myinfo-emoji-grid";

    group.items.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "myinfo-emoji-option";
      button.textContent = emoji;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(emoji === selectedEmoji));
      button.classList.toggle("is-selected", emoji === selectedEmoji);
      button.addEventListener("click", () => onSelect(emoji));
      grid.appendChild(button);
    });

    section.append(title, grid);
    picker.appendChild(section);
  });
}

async function saveMyInfoAvatarEmoji(client, userId, emoji) {
  const { error: profileError } = await client
    .from("profiles")
    .update({ avatar_emoji: emoji })
    .eq("id", userId);
  if (profileError) throw profileError;

  const { error: feedError } = await client
    .from("feed_posts")
    .update({ author_avatar: emoji })
    .eq("owner_id", userId);
  if (feedError) throw feedError;
}

async function saveMyInfoAvatarBgColor(client, userId, bgColor) {
  const color = normalizeAvatarBgColor(bgColor);
  const { error: profileError } = await client
    .from("profiles")
    .update({ avatar_bg_color: color })
    .eq("id", userId);
  if (profileError) throw profileError;

  const { error: feedError } = await client
    .from("feed_posts")
    .update({ author_avatar_bg: color })
    .eq("owner_id", userId);
  if (feedError) throw feedError;
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
  setMyInfoAvatar("", "guest", "#eef3ff");
  setMyInfoAvatarBgPreview("", "guest", "#eef3ff");
  setMyInfoSummary("-", "-");
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
  let avatarEmoji = "";
  let avatarBgColor = "#eef3ff";
  const pageTitle = nickname && nickname !== "-" ? `${nickname}님의 정보` : "나의 정보";
  const packagesTitle = nickname && nickname !== "-" ? `${nickname}님의 악보` : "나의 악보";

  $("#myInfoPageTitle").textContent = pageTitle;
  $("#myInfoPackagesTitle").textContent = packagesTitle;
  document.title = pageTitle;
  setMyInfoSummary(nickname, email);

  try {
    const { data: profile } = await client
      .from("profiles")
      .select("avatar_emoji, avatar_bg_color")
      .eq("id", session.user.id)
      .maybeSingle();
    avatarEmoji = String(profile?.avatar_emoji || "").trim();
    avatarBgColor = normalizeAvatarBgColor(profile?.avatar_bg_color || "#eef3ff");
  } catch {}

  const getAvatarSeed = () => userId || nickname || email;
  const handleAvatarSelect = async (nextEmoji) => {
    if (myInfoAvatarUpdating) return;
    myInfoAvatarUpdating = true;
    try {
      await saveMyInfoAvatarEmoji(client, userId, nextEmoji);
      avatarEmoji = nextEmoji;
      setMyInfoAvatar(avatarEmoji, getAvatarSeed(), avatarBgColor);
      setMyInfoAvatarBgPreview(avatarEmoji, getAvatarSeed(), avatarBgColor);
      setMyInfoStatus("프로필 이모지가 저장되었습니다.");
      setMyInfoEmojiModal(false);
    } catch {
      setMyInfoStatus("프로필 이모지를 저장하지 못했습니다.", true);
    } finally {
      myInfoAvatarUpdating = false;
    }
  };
  const applyAvatar = (emoji = avatarEmoji) => {
    avatarEmoji = String(emoji || "").trim();
    setMyInfoAvatar(avatarEmoji, getAvatarSeed(), avatarBgColor);
    setMyInfoAvatarBgPreview(avatarEmoji, getAvatarSeed(), avatarBgColor);
    renderMyInfoEmojiPicker(getMyInfoAvatarValue(avatarEmoji, getAvatarSeed()), handleAvatarSelect);
  };
  applyAvatar(avatarEmoji);
  myInfoAvatarBgColorDraft = avatarBgColor;

  $("#myInfoAvatarButton")?.addEventListener("click", () => {
    renderMyInfoEmojiPicker(getMyInfoAvatarValue(avatarEmoji, getAvatarSeed()), handleAvatarSelect);
    myInfoAvatarBgColorDraft = avatarBgColor;
    setMyInfoEmojiTab("emoji");
    setMyInfoAvatarBgPreview(avatarEmoji, getAvatarSeed(), avatarBgColor);
    setMyInfoEmojiModal(true);
  });

  $("#myInfoEmojiTab")?.addEventListener("click", () => {
    setMyInfoEmojiTab("emoji");
  });
  $("#myInfoAvatarBgTab")?.addEventListener("click", () => {
    myInfoAvatarBgColorDraft = avatarBgColor;
    setMyInfoAvatarBgPreview(avatarEmoji, getAvatarSeed(), myInfoAvatarBgColorDraft);
    setMyInfoEmojiTab("bg");
    drawMyInfoAvatarBgWheel();
  });

  $("#myInfoAvatarBgWheel")?.addEventListener("pointerdown", (event) => {
    myInfoAvatarBgDragging = true;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    handleMyInfoAvatarBgPointer(event, avatarEmoji, getAvatarSeed());
  });
  $("#myInfoAvatarBgWheel")?.addEventListener("pointermove", (event) => {
    if (!myInfoAvatarBgDragging) return;
    handleMyInfoAvatarBgPointer(event, avatarEmoji, getAvatarSeed());
  });
  $("#myInfoAvatarBgWheel")?.addEventListener("pointerup", () => {
    myInfoAvatarBgDragging = false;
  });
  $("#myInfoAvatarBgWheel")?.addEventListener("pointerleave", () => {
    myInfoAvatarBgDragging = false;
  });

  $("#myInfoAvatarBgSaveBtn")?.addEventListener("click", async () => {
    if (myInfoAvatarBgUpdating) return;
    myInfoAvatarBgUpdating = true;
    const nextColor = normalizeAvatarBgColor(myInfoAvatarBgColorDraft || avatarBgColor);
    try {
      await saveMyInfoAvatarBgColor(client, userId, nextColor);
      avatarBgColor = nextColor;
      setMyInfoAvatar(avatarEmoji, getAvatarSeed(), avatarBgColor);
      setMyInfoAvatarBgPreview(avatarEmoji, getAvatarSeed(), avatarBgColor);
      setMyInfoStatus("프로필 배경색이 저장되었습니다.");
      setMyInfoEmojiModal(false);
    } catch {
      setMyInfoStatus("프로필 배경색을 저장하지 못했습니다.", true);
    } finally {
      myInfoAvatarBgUpdating = false;
    }
  });

  document.querySelectorAll("[data-myinfo-emoji-close]").forEach((node) => {
    node.addEventListener("click", () => setMyInfoEmojiModal(false));
  });

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
