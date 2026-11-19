/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 *
 * 다크 모드는 2026-11에 없앴습니다. 예전에 다크 모드를 켜둔 사람이 다크 화면에 남지 않도록
 * 저장된 설정을 지우고 항상 라이트로 보여줍니다.
 */
(function () {
  try {
    localStorage.removeItem("scorebox-ui-theme");
  } catch {}
  delete document.documentElement.dataset.uiTheme;
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body) delete document.body.dataset.uiTheme;
  });
})();
