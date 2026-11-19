/*
 * Copyright (c) 2026 꿈꾸는교회 중고등부 찬양팀.
 * All rights reserved.
 *
 * 관리자 전용: 업로드된 악보 승인/반려.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  let currentTab = "pending";
  let client = null;

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function songUrl(row) {
    const url = new URL("./song.html", location.href);
    url.search = "";
    url.searchParams.set("s", row.slug || row.id);
    return url.toString();
  }

  function setNotice(text) {
    const el = $("#reviewNotice");
    el.textContent = text;
    el.classList.toggle("hidden", !text);
  }

  const KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

  // 승인/반려 시 관리자가 고친 제목·아티스트·Key를 함께 저장
  async function saveAndSetStatus(row, fields, status, btn) {
    const patch = { status };
    if (fields) {
      const title = fields.title.value.trim();
      if (status === "approved" && !title) {
        alert("제목을 입력해 주세요.");
        fields.title.focus();
        return;
      }
      if (title) patch.title = title;
      patch.artist = fields.artist.value.trim();
      patch.key = fields.key.value;
      if (status === "approved" && !patch.key) {
        if (!confirm("Key가 비어 있어요. 이대로 승인할까요?")) {
          fields.key.focus();
          return;
        }
      }
    }
    btn.disabled = true;
    const { data, error } = await client
      .from("songs")
      .update(patch)
      .eq("id", row.id)
      .select("id");
    if (error || !data?.length) {
      console.error(error);
      alert("처리하지 못했어요. 관리자 권한과 DB 마이그레이션 적용 여부를 확인해 주세요.");
      btn.disabled = false;
      return;
    }
    await load();
  }

  async function removeSong(row, btn) {
    if (!confirm(`'${row.title}' 악보를 완전히 삭제할까요? 되돌릴 수 없어요.`)) return;
    btn.disabled = true;
    const { data, error } = await client.from("songs").delete().eq("id", row.id).select("id");
    if (error || !data?.length) {
      console.error(error);
      alert("삭제하지 못했어요.");
      btn.disabled = false;
      return;
    }
    await load();
  }

  function button(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener("click", () => onClick(b));
    return b;
  }

  function field(labelText, control) {
    const label = document.createElement("label");
    label.className = "review-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, control);
    return label;
  }

  function textInput(value, placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.value = value || "";
    input.placeholder = placeholder;
    return input;
  }

  function keySelect(value) {
    const select = document.createElement("select");
    select.className = "select";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "선택";
    select.appendChild(empty);
    const keys = value && !KEYS.includes(value) ? [value, ...KEYS] : KEYS;
    keys.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    });
    select.value = value || "";
    return select;
  }

  function render(rows) {
    const list = $("#reviewList");
    list.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "review-empty";
      empty.textContent = currentTab === "pending" ? "승인을 기다리는 악보가 없어요." : "반려된 악보가 없어요.";
      list.appendChild(empty);
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement("article");
      item.className = "review-item";

      // 미리보기 (이미지는 썸네일, PDF는 아이콘) → 새 탭에서 곡 페이지
      const preview = document.createElement("a");
      preview.className = "review-preview";
      preview.href = songUrl(row);
      preview.target = "_blank";
      preview.rel = "noopener";
      preview.title = "새 탭에서 악보 보기";
      if (row.jpg_url) {
        const img = document.createElement("img");
        img.src = row.jpg_url;
        img.alt = "";
        img.loading = "lazy";
        preview.appendChild(img);
      } else {
        preview.classList.add("is-pdf");
        preview.textContent = "PDF";
      }
      const previewLabel = document.createElement("span");
      previewLabel.className = "review-preview-label";
      previewLabel.textContent = "악보 보기";
      preview.appendChild(previewLabel);

      const fields = {
        title: textInput(row.title, "제목"),
        artist: textInput(row.artist, "아티스트"),
        key: keySelect(row.key),
      };
      fields.artist.setAttribute("list", "reviewArtistList");

      const form = document.createElement("div");
      form.className = "review-form";
      const date = document.createElement("span");
      date.className = "review-date";
      date.textContent = `${formatDate(row.created_at)} 업로드`;
      form.append(
        field("제목", fields.title),
        field("아티스트", fields.artist),
        field("Key", fields.key),
        date,
      );

      const actions = document.createElement("div");
      actions.className = "review-actions";
      if (currentTab === "pending") {
        actions.append(
          button("반려", "", (b) => saveAndSetStatus(row, null, "rejected", b)),
          button("승인", "primary", (b) => saveAndSetStatus(row, fields, "approved", b)),
        );
      } else {
        actions.append(
          button("삭제", "is-destructive", (b) => removeSong(row, b)),
          button("승인", "primary", (b) => saveAndSetStatus(row, fields, "approved", b)),
        );
      }
      item.append(preview, form, actions);
      list.appendChild(item);
    });
  }

  async function loadArtistSuggestions() {
    const { data } = await client.from("songs").select("artist").eq("status", "approved");
    const names = Array.from(new Set((data || []).map((r) => String(r.artist || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "ko"));
    let list = document.querySelector("#reviewArtistList");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "reviewArtistList";
      document.body.appendChild(list);
    }
    list.innerHTML = "";
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      list.appendChild(opt);
    });
  }

  async function load() {
    const { data, error } = await client
      .from("songs")
      .select("id, slug, title, artist, key, pdf_url, jpg_url, created_at, status")
      .eq("status", currentTab)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      setNotice("목록을 불러오지 못했어요. supabase/migrations/20261119_song_links_and_approval.sql 적용 여부를 확인해 주세요.");
      render([]);
      return;
    }
    setNotice("");
    render(data || []);
  }

  function bindTabs() {
    document.querySelectorAll("[data-review-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.reviewTab;
        document.querySelectorAll("[data-review-tab]").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-current", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        load();
      });
    });
  }

  async function init() {
    if (!window.SB?.isConfigured?.()) return;
    client = window.SB.getClient();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) {
      location.replace(`./auth.html?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const { data: profile } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (String(profile?.role || "") !== "admin") {
      $("#reviewMain").classList.add("hidden");
      setNotice("관리자만 볼 수 있는 페이지예요.");
      return;
    }
    bindTabs();
    loadArtistSuggestions().catch(() => {});
    await load();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
      setNotice("페이지를 불러오는 중 오류가 발생했어요.");
    });
  });
})();
