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

    const { count, error } = await client
      .from("songs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error || !count) return;
    document.querySelectorAll("[data-pending-count]").forEach((el) => {
      el.textContent = String(count);
      el.classList.remove("hidden");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    markCurrent();
    revealAdminMenu().catch(() => {});
  });
})();
