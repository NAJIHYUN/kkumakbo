/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 */
(function () {
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

  async function getSession() {
    if (!window.SB || !window.SB.isConfigured?.()) return null;
    const client = window.SB.getClient?.();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch {
      return null;
    }
  }

  function setGuestMode(root) {
    const guestActions = document.querySelector("[data-guest-actions]");
    if (!guestActions) return;

    root?.querySelectorAll("[data-guest-hide]").forEach((el) => el.classList.add("hidden"));
    guestActions.classList.remove("hidden");

    const loginUrl = buildAuthModeUrl("signin");
    const signupUrl = buildAuthModeUrl("signup");
    document.querySelector("[data-guest-login]")?.addEventListener("click", () => {
      location.href = loginUrl;
    });
    document.querySelector("[data-guest-signup]")?.addEventListener("click", () => {
      location.href = signupUrl;
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.querySelector("[data-guest-page]");
    if (!root) return;
    const session = await getSession();
    if (session) return;
    setGuestMode(root);
  });
})();
