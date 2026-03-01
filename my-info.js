/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 */
const $ = (s) => document.querySelector(s);
const KOR_INITIALS = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"
];

let myInfoPasswordUpdating = false;

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

function matchesPackagesQuery(item, query) {
  const q = normalize(query);
  if (!q) return true;
  const name = normalize(item?.name || "");
  const vault = normalize(item?.vaultLabel || "");
  const merged = `${name} ${vault}`;
  if (/[ㄱ-ㅎ]/.test(q)) {
    return `${getChosung(name)}${getChosung(vault)}`.includes(q.replace(/\s+/g, ""));
  }
  return name.includes(q) || vault.includes(q) || merged.includes(q);
}

function getVaultLabel(vault = "") {
  const v = String(vault || "").toLowerCase();
  if (v === "high") return "고등부";
  if (v === "middle") return "중등부";
  return "기타";
}

function getRoleLabel(role = "") {
  const value = String(role || "").toLowerCase();
  if (value === "admin") return "관리자";
  if (value === "high") return "고등부";
  if (value === "middle") return "중등부";
  if (value === "all") return "기타";
  return "-";
}

async function loadMyPackages() {
  const client = window.SB?.getClient?.();
  if (!client) return [];
  const { data, error } = await client
    .from("packages")
    .select("id, name, url, vault, created_at")
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name || "이름 없는 패키지",
    url: row.url || "",
    vault: row.vault || "all",
    vaultLabel: getVaultLabel(row.vault),
    createdAt: row.created_at,
  }));
}

async function deletePackage(id) {
  const client = window.SB?.getClient?.();
  if (!client || !id) return false;
  const { error } = await client.from("packages").delete().eq("id", id);
  return !error;
}

async function shareLink(url, name = "패키지") {
  const payload = {
    title: `패키지: ${name}`,
    text: `${name} 패키지 링크입니다.`,
    url,
  };
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert("링크를 복사했어요.");
  } catch {
    prompt("복사해서 사용하세요:", url);
  }
}

async function renderPackages(query = "") {
  const list = $("#myPackagesList");
  if (!list) return;
  const items = (await loadMyPackages()).filter((item) => matchesPackagesQuery(item, query));

  list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "vault-empty";
    empty.textContent = "생성한 패키지가 없습니다.";
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

    const packageNameEl = document.createElement("span");
    packageNameEl.className = "vault-package-name";
    packageNameEl.textContent = item.name;

    const vaultEl = document.createElement("span");
    vaultEl.className = "vault-item-nickname";
    vaultEl.textContent = item.vaultLabel;

    name.append(packageNameEl, vaultEl);

    const date = document.createElement("div");
    date.className = "vault-item-date";
    date.textContent = formatDate(item.createdAt);
    meta.append(name, date);

    const actions = document.createElement("div");
    actions.className = "vault-item-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn vault-btn-open";
    openBtn.textContent = "열기";
    openBtn.addEventListener("click", () => window.open(item.url, "_blank"));

    const shareBtn = document.createElement("button");
    shareBtn.className = "btn vault-btn-share";
    shareBtn.textContent = "공유";
    shareBtn.addEventListener("click", async () => {
      await shareLink(item.url, item.name);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn vault-btn-delete";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", async () => {
      if (!confirm("정말 삭제할까요?")) return;
      const ok = await deletePackage(item.id);
      if (!ok) {
        alert("삭제에 실패했어요.");
        return;
      }
      await renderPackages($("#myPackagesSearch")?.value || "");
    });

    actions.append(openBtn, shareBtn, delBtn);
    row.append(meta, actions);
    list.appendChild(row);
  });
}

async function init() {
  if (!window.SB?.isConfigured()) return;
  const client = window.SB.getClient();
  if (!client) return;

  const { data } = await client.auth.getSession();
  const session = data?.session || null;
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    location.replace(`./auth.html?next=${encodeURIComponent(next)}`);
    return;
  }

  const nickname = String(
    session.user?.user_metadata?.nickname ||
    session.user?.email?.split("@")[0] ||
    "-"
  );
  const email = String(session.user?.email || "-");
  const pageTitle = nickname && nickname !== "-" ? `${nickname}님의 정보` : "나의 정보";
  const packagesTitle = nickname && nickname !== "-" ? `${nickname}님의 패키지` : "나의 패키지";

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
    location.replace("./auth.html");
  });

  const searchInput = $("#myPackagesSearch");
  const clearBtn = $("#btnClearMyPackagesSearch");
  const syncClear = () => {
    const has = (searchInput?.value || "").trim().length > 0;
    clearBtn?.classList.toggle("hidden", !has);
  };

  searchInput?.addEventListener("input", async () => {
    syncClear();
    await renderPackages(searchInput.value || "");
  });
  clearBtn?.addEventListener("click", async () => {
    if (!searchInput) return;
    searchInput.value = "";
    syncClear();
    searchInput.focus();
    await renderPackages("");
  });

  syncClear();
  await renderPackages("");
}

init().catch((err) => {
  console.error("my info page 초기화 실패:", err);
  setMyInfoStatus("나의 정보를 불러오는 중 오류가 발생했습니다.", true);
});
