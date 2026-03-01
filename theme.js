/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 */
(function () {
  const STORAGE_KEY = "scorebox-ui-theme";
  const MOBILE_QUERY = "(max-width: 768px)";

  function isMobileViewport() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function apply(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    if (!isMobileViewport()) {
      delete document.documentElement.dataset.uiTheme;
      if (document.body) {
        delete document.body.dataset.uiTheme;
      }
      return;
    }
    document.documentElement.dataset.uiTheme = nextTheme;
    if (document.body) {
      document.body.dataset.uiTheme = nextTheme;
    }
  }

  function set(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {}
    apply(nextTheme);
  }

  function init() {
    apply(getStoredTheme());
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => apply(getStoredTheme());
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
    } else if (typeof media.addListener === "function") {
      media.addListener(sync);
    }
  }

  window.ScoreboxTheme = {
    getStoredTheme,
    apply,
    set,
    isMobileViewport,
  };

  init();
})();
