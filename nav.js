/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 *
 * 공통 내비게이션: 현재 페이지 표시 + 관리자 전용 메뉴(승인 대기) 노출.
 */
(function () {
  function currentKey() {
    const file = (location.pathname.split("/").pop() || "index.html").replace(/\.html?$/, "");
    if (!file || file === "song") return "index";
    return file;
  }

  function markCurrent() {
    const key = currentKey();
    document.querySelectorAll("[data-nav]").forEach((el) => {
      const on = el.dataset.nav === key;
      el.classList.toggle("is-current", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  async function revealAdminMenu() {
    if (!window.SB?.isConfigured?.()) return;
    const client = window.SB.getClient?.();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;

    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (String(profile?.role || "") !== "admin") return;

    document.querySelectorAll("[data-admin-only]").forEach((el) => el.classList.remove("hidden"));

    // 승인 대기 = 대기 중인 악보 + 가입 승인 대기 회원
    const [songs, members] = await Promise.all([
      client.from("songs").select("id", { count: "exact", head: true }).eq("status", "pending"),
      client.from("profiles").select("id", { count: "exact", head: true }).eq("approved", false),
    ]);
    const count = (songs.error ? 0 : songs.count || 0) + (members.error ? 0 : members.count || 0);
    if (!count) return;
    document.querySelectorAll("[data-pending-count]").forEach((el) => {
      el.textContent = String(count);
      el.classList.remove("hidden");
    });
  }

  // 모바일: 헤더 오른쪽 햄버거 버튼 → 홈 · 즐겨찾기 · (승인 대기) · MY 메뉴
  function setupMenuButton() {
    document.querySelectorAll(".app-nav").forEach((nav, i) => {
      if (nav.previousElementSibling?.classList.contains("app-menu-btn")) return;
      if (!nav.id) nav.id = `appNav${i || ""}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-menu-btn";
      btn.setAttribute("aria-label", "메뉴 열기");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", nav.id);
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>';
      nav.parentElement.insertBefore(btn, nav);

      const setOpen = (open) => {
        nav.classList.toggle("is-open", open);
        btn.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
      };
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!nav.classList.contains("is-open"));
      });
      nav.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => setOpen(false));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && nav.classList.contains("is-open")) {
          setOpen(false);
          btn.focus();
        }
      });
      window.addEventListener("resize", () => setOpen(false));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupMenuButton();
    markCurrent();
    revealAdminMenu().catch(() => {});
  });
})();
