#!/usr/bin/env node
/*
 * 블로그 글 링크로 악보 올리기 (관리자용)
 *
 *   제목 예: "[찬양 악보/가사] 기뻐하며 경배하세 - 피아워십(F.I.A WORSHIP) G코드"
 *            → 곡명 "기뻐하며 경배하세" / 아티스트 "피아워십" / 키 G
 *   본문의 악보 이미지(첨부 원본 우선)를 순서대로 내려받아 올림. 2장 이상이면 PDF 하나로 합침.
 *   실제 업로드·중복 검사·PDF 합치기는 upload-folder.mjs를 그대로 사용.
 *
 * 키가 이상하면(단조 Em, 못 읽음, 여러 키 등) 올리지 않고 보류 목록에 적어둠:
 *   ~/코딩/DB/보류목록.json
 *
 * 사용법 (kkumakbo 폴더에서):
 *   node scripts/upload-from-url.mjs <링크> [<링크> ...]            # 미리보기
 *   node scripts/upload-from-url.mjs <링크> [<링크> ...] --apply    # 업로드 (+ 이상한 키는 보류)
 *   node scripts/upload-from-url.mjs --range=https://music-in.tistory.com/798..1117 [--apply]   # 번호 범위
 *   node scripts/upload-from-url.mjs --pending                      # 보류 목록 보기
 *   node scripts/upload-from-url.mjs --pending --apply              # 보류 목록을 제목의 키 그대로 올림
 *   node scripts/upload-from-url.mjs --pending --apply --key="<링크>=Em" --skip="<링크>"
 *       --key: 특정 링크의 키를 바꿔서 올림 / --skip: 특정 링크는 이번에 올리지 않음
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PENDING_FILE = join(homedir(), "코딩", "DB", "보류목록.json");
const KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const pendingMode = args.includes("--pending");
const keyOverrides = new Map(
  args.filter((a) => a.startsWith("--key=")).map((a) => {
    const v = a.slice(6);
    const i = v.lastIndexOf("=");
    return [v.slice(0, i).trim(), v.slice(i + 1).trim()];
  }),
);
const skips = new Set(args.filter((a) => a.startsWith("--skip=")).map((a) => a.slice(7).trim()));
const urls = args.filter((a) => /^https?:\/\//.test(a));
// --range=https://music-in.tistory.com/798..1117 → 798~1117번 글 전부
for (const a of args.filter((x) => x.startsWith("--range="))) {
  const m = a.slice(8).match(/^(https?:\/\/[^\s]+\/)(\d+)\.\.(\d+)$/);
  if (!m) continue;
  const [from, to] = [Number(m[2]), Number(m[3])].sort((x, y) => x - y);
  for (let n = from; n <= to; n += 1) urls.push(`${m[1]}${n}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s = "") => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const clean = (s = "") => String(s).normalize("NFC").replace(/[\\/:*?"<>|_]+/g, " ").replace(/\s+/g, " ").trim();

function loadPending() {
  if (!existsSync(PENDING_FILE)) return [];
  try { return JSON.parse(readFileSync(PENDING_FILE, "utf8")); } catch { return []; }
}
function savePending(list) {
  writeFileSync(PENDING_FILE, JSON.stringify(list, null, 2) + "\n");
}

// "[찬양 악보/가사] 곡명 - 아티스트(영문) G코드" → { title, artist, key }
function parseTitle(raw = "") {
  let t = decode(raw).normalize("NFC").trim();
  t = t.replace(/^\s*\[[^\]]*\]\s*/, "");
  // 곡명과 아티스트 사이의 "-" (앞뒤 띄어쓰기 없어도 됨: "곡명- 아티스트", "곡명-아티스트")
  const dashMatch = [...t.matchAll(/\s*-\s*/g)].pop();
  if (!dashMatch) return { problem: "제목에 ' - '가 없어 곡명/아티스트를 나눌 수 없음" };
  const dash = dashMatch.index;
  const dashLen = dashMatch[0].length;
  // 찬송가/복음성가 표시 꼬리는 떼기: "(찬송가 563장)", "(F.I.A 버전 찬송가)", "(찬송가)", "(복음성가)"
  // (Feat. 가수)나 부제 괄호는 그대로 둠
  const title = clean(t.slice(0, dash)
    .replace(/\s*\(\s*(?:F\.?\s*I\.?\s*A\.?\s*버전\s*)?(?:찬송가(?:\s*\d+\s*장)?|복음성가)\s*\)/gi, ""));
  let rest = t.slice(dash + dashLen).trim();
  // 키: "G코드", "A,B코드", "key: C" — 키 뒤에 "고화질", "마커스 커뮤니티", "키업" 같은 말이 붙어도 됨
  const keyMatch = rest.match(/(?:^|\s|\))([A-Ga-g][#b♭♯]?m?(?:\s*[,/]\s*[A-Ga-g][#b♭♯]?m?)*)\s*(?:코드|key)(?=\s|$)/i)
    || rest.match(/(?:key|키)\s*[:=]?\s*([A-Ga-g][#b♭♯]?m?)\s*$/i);
  if (!keyMatch) return { title, artist: clean(rest.replace(/\([^)]*\)/g, "")), problem: "제목에서 키를 찾지 못함" };
  rest = rest.slice(0, keyMatch.index + (keyMatch[0].length - keyMatch[0].trimStart().length)).replace(/\)\s*$/, ")").trim();
  const artist = clean(rest.replace(/\([^)]*\)/g, ""));
  const rawKey = keyMatch[1].replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
  const toKey = (x) => KEYS.find((k) => k.toLowerCase() === x.toLowerCase()) || x;
  const keys = rawKey.split(/[,/]/).filter(Boolean).map(toKey);
  const key = keys[0];
  if (!title) return { problem: "곡명이 비어 있음" };
  if (!artist) return { title, key, problem: "아티스트가 비어 있음" };
  // 키가 여러 개(C,D 등)면 첫 번째 키로 — 이미지 고르기는 inspect에서
  if (keys.length > 1) {
    if (KEYS.includes(key)) return { title, artist, key, keys }; // 첫 키만 일반 장조면 OK
    return { title, artist, key: keys.join(","), problem: `키 '${keys.join(",")}' 중 일반 장조가 아닌 키가 있음` };
  }
  if (!KEYS.includes(key)) return { title, artist, key, problem: `키 '${key}'가 일반 장조 키가 아님` };
  return { title, artist, key };
}

// 본문의 악보 이미지: 첨부 원본(attach=1) 우선, 없으면 본문 이미지. 관련글 썸네일 등은 제외
function extractImages(html = "") {
  const start = html.search(/class="[^"]*tt_article_useless_p_margin/);
  let body = start >= 0 ? html.slice(start) : html;
  const end = body.search(/class="[^"]*(related-articles|another_category|container_postbtn)/);
  if (end > 0) body = body.slice(0, end);
  const attach = [...body.matchAll(/<a[^>]+href="(https:\/\/blog\.kakaocdn\.net\/dna\/[^"]+attach=1[^"]*)"/g)]
    .map((m) => decode(m[1]))
    .filter((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(decodeURIComponent(u.split("?")[0])) || /knm=[^&]*\.(png|jpe?g|webp)/i.test(u));
  const inline = [...body.matchAll(/<img[^>]+src="(https:\/\/blog\.kakaocdn\.net\/dna\/[^"]+)"/g)].map((m) => decode(m[1]));
  const list = attach.length ? attach : inline;
  const out = [...new Set(list)];
  out.fallback = attach.length ? [...new Set(inline)] : []; // 첨부가 안 받아지면 본문 이미지로 재시도
  return out;
}

// 여러 키 글에서 첫 번째 키의 이미지만 고르기.
// 첨부 파일 이름에 키가 적혀 있음: "곡_C.png", "곡_FKey_1.png", 키 없는 이름 = 제목 키 중 이름에 안 나온 키
function fileBase(u = "") {
  const knm = (u.match(/[?&]knm=([^&]+)/) || [])[1];
  const raw = decodeURIComponent(u.split("?")[0].split("/").pop() || "");
  const name = raw && !/^img\.(png|jpe?g)$/i.test(raw) ? raw : decodeURIComponent(knm || raw);
  return name.normalize("NFC").replace(/\.(png|jpe?g|webp)$/i, "");
}
function keyInName(base, keys) {
  const sorted = [...keys].sort((a, b) => b.length - a.length); // Ab, Bb 먼저
  for (const k of sorted) {
    const esc = k.replace(/[#]/g, "\\#");
    if (new RegExp(`(?:^|[_\\s-])${esc}\\s*(?:key)?(?:[_\\s-]*\\d+)?$`, "i").test(base)) return k;
  }
  return "";
}
function pickImagesForKey(images, key, keys) {
  const tagged = images.map((u) => ({ u, k: keyInName(fileBase(u), keys) }));
  const mine = tagged.filter((t) => t.k === key).map((t) => t.u);
  if (mine.length) return mine;
  const labeled = new Set(tagged.map((t) => t.k).filter(Boolean));
  const unlabeled = tagged.filter((t) => !t.k).map((t) => t.u);
  // 첫 키만 이름에 안 나오고, 나머지 키는 모두 이름에 있으면 → 이름 없는 이미지가 첫 키
  if (unlabeled.length && !labeled.has(key) && keys.filter((k) => k !== key).every((k) => labeled.has(k))) return unlabeled;
  return [];
}

async function inspect(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return { url, excluded: `페이지 없음 (${res.status})` };
  const html = await res.text();
  const og = html.match(/<meta property="og:title" content="([^"]*)"/);
  const rawTitle = decode(og ? og[1] : (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  // 악보 글이 아니면(공지 등) 보류가 아니라 제외
  if (!/악보/.test(rawTitle)) return { url, rawTitle, excluded: "악보 글이 아님" };
  if (/목록|모음/.test(rawTitle)) return { url, rawTitle, excluded: "악보 목록 글 (곡 악보가 아님)" };
  const parsed = parseTitle(rawTitle);
  let images = extractImages(html);
  if (parsed.keys && !parsed.problem) {
    const picked = pickImagesForKey(images, parsed.key, parsed.keys);
    if (!picked.length) return { url, rawTitle, ...parsed, key: parsed.keys.join(","), images, problem: `키가 여러 개(${parsed.keys.join(",")})인데 첫 키(${parsed.key}) 악보를 구분하지 못함` };
    images = picked;
  }
  const item = { url, rawTitle, ...parsed, images, fallback: parsed.keys ? [] : (images.fallback || []) };
  if (!images.length) item.problem = item.problem || "본문에서 악보 이미지를 찾지 못함";
  return item;
}

function extOf(u, contentType = "") {
  if (/png/i.test(contentType)) return ".png";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  const m = decodeURIComponent(u.split("?")[0]).match(/\.(png|jpe?g|webp)$/i);
  return m ? `.${m[1].toLowerCase().replace("jpeg", "jpg")}` : ".png";
}

// 이미지들을 임시 폴더에 "곡명_아티스트_키(_n).ext"로 받아서 upload-folder.mjs로 올림
async function download(url, referer) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: referer } });
  if (!r.ok) throw new Error(String(r.status));
  return { buf: Buffer.from(await r.arrayBuffer()), ext: extOf(url, r.headers.get("content-type")) };
}

// 곡마다 이미지를 받아서 임시 폴더에 "곡명_아티스트_키(_n).ext"로 저장 → upload-folder.mjs로 올림.
// 이미지가 안 받아지는 곡은 그 곡만 실패로 돌려줌 (나머지는 계속)
async function uploadItems(items) {
  const dir = mkdtempSync(join(tmpdir(), "kkumakbo-links-"));
  const failed = [];
  try {
    for (const it of items) {
      let files = null;
      for (const list of [it.images, it.fallback].filter((l) => l && l.length)) {
        try {
          const got = [];
          for (const u of list) got.push(await download(u, it.url));
          files = got;
          break;
        } catch {}
      }
      if (!files) {
        failed.push({ ...it, problem: "악보 이미지를 내려받지 못함 (블로그 이미지가 지워졌거나 막힘)" });
        continue;
      }
      files.forEach((f, i) => {
        const name = `${it.title}_${it.artist}_${it.key}${files.length > 1 ? `_${i + 1}` : ""}${f.ext}`;
        writeFileSync(join(dir, name), f.buf);
      });
    }
    const out = spawnSync("node", [join(HERE, "upload-folder.mjs"), dir, "--apply"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(out.stdout.split("\n").filter((l) => /^\s+(완료|교체|실패|건너뜀)|업로드 완료/.test(l)).join("\n") + "\n");
    if (out.status !== 0) console.error(out.stderr || "업로드 중 오류");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return failed;
}

const fmt = (it) => `${it.title || "?"} / ${it.artist || "?"} / ${it.key || "?"}  (이미지 ${typeof it.images === "number" ? it.images : it.images?.length || 0}장)`;

async function main() {
  if (pendingMode) {
    const pending = loadPending();
    if (!pending.length) { console.log("보류 목록이 비어 있어요."); return; }
    console.log(`보류 목록 ${pending.length}개 (${PENDING_FILE})\n`);
    pending.forEach((p, i) => console.log(`  ${i + 1}. ${fmt(p)}\n     이유: ${p.problem}\n     제목: ${p.rawTitle}\n     ${p.url}`));
    if (!apply) return;
    const fresh = [];
    const removed = new Set();
    for (const p of pending) {
      if (skips.has(p.url)) continue;
      const it = await inspect(p.url); // 이미지 주소는 만료되므로 다시 읽음
      if (it.excluded) {
        console.log(`  제외(목록에서 지움)  ${p.url} — ${it.excluded}`);
        removed.add(p.url);
        continue;
      }
      // 여전히 문제가 있으면(단조 키 등) 계속 보류 — --key로 키를 정해주거나 --force일 때만 올림
      if (it.problem && !keyOverrides.has(p.url) && !args.includes("--force")) {
        console.log(`  보류 유지  ${fmt(it)} — ${it.problem}`);
        continue;
      }
      const key = keyOverrides.get(p.url) || it.key;
      if (!it.title || !it.artist || !key || !it.images?.length) {
        console.log(`  건너뜀  ${p.url} — ${it.problem}`);
        continue;
      }
      fresh.push({ ...it, key });
    }
    const failed = fresh.length ? await uploadItems(fresh) : [];
    const failedUrls = new Set(failed.map((f) => f.url));
    failed.forEach((f) => console.log(`  보류 유지  ${fmt(f)} — ${f.problem}`));
    const done = new Set(fresh.map((f) => f.url).filter((u) => !failedUrls.has(u)));
    savePending(pending.filter((p) => !done.has(p.url) && !removed.has(p.url)));
    console.log(`\n보류 목록에서 ${done.size}개 처리, 남은 보류 ${pending.length - done.size}개`);
    return;
  }

  if (!urls.length) {
    console.error("링크를 주세요. 예: node scripts/upload-from-url.mjs https://music-in.tistory.com/1117");
    process.exit(1);
  }
  const items = [];
  for (let i = 0; i < urls.length; i += 1) {
    try {
      items.push(await inspect(urls[i]));
    } catch (err) {
      items.push({ url: urls[i], problem: `읽기 오류 (${err.message})` });
    }
    if (urls.length > 1) await sleep(250); // 블로그에 부담 주지 않게
    if (urls.length > 20 && (i + 1) % 50 === 0) console.error(`  … ${i + 1}/${urls.length} 읽음`);
  }
  // 같은 곡(곡명+아티스트+키)이 여러 글에 있으면 이미지가 가장 많은 글 하나만
  const sameKey = (it) => `${it.title}|${it.artist}|${it.key}`.toLowerCase().replace(/\s+/g, "");
  const best = new Map();
  items.filter((it) => !it.excluded && !it.problem).forEach((it) => {
    const k = sameKey(it);
    if (!best.has(k) || it.images.length > best.get(k).images.length) best.set(k, it);
  });
  items.forEach((it) => {
    if (it.excluded || it.problem) return;
    const winner = best.get(sameKey(it));
    if (winner !== it) it.excluded = `같은 곡의 다른 글이 있음 → 이미지가 더 많은 ${winner.url} 를 올림`;
  });
  const excluded = items.filter((it) => it.excluded);
  const ok = items.filter((it) => !it.excluded && !it.problem);
  const held = items.filter((it) => !it.excluded && it.problem);

  console.log(`${apply ? "업로드" : "미리보기 (--apply로 실행)"}\n`);
  ok.forEach((it) => console.log(`  올림  ${fmt(it)}`));
  held.forEach((it) => console.log(`  보류  ${fmt(it)} — ${it.problem}\n        ${it.url}`));
  excluded.forEach((it) => console.log(`  제외  ${it.url} — ${it.excluded}${it.rawTitle ? ` (${it.rawTitle})` : ""}`));
  console.log(`\n올릴 ${ok.length}개, 보류 ${held.length}개, 제외 ${excluded.length}개`);
  if (!apply) return;

  const addPending = (list) => {
    if (!list.length) return;
    const pending = loadPending();
    const known = new Set(pending.map((p) => p.url));
    list.forEach((it) => {
      if (known.has(it.url)) return;
      pending.push({ url: it.url, rawTitle: it.rawTitle, title: it.title || "", artist: it.artist || "", key: it.key || "", problem: it.problem, images: it.images?.length || 0, heldAt: new Date().toISOString() });
    });
    savePending(pending);
    console.log(`보류 ${list.length}개를 보류 목록에 적었어요: ${PENDING_FILE}`);
  };
  addPending(held); // 업로드 전에 먼저 저장
  if (ok.length) {
    const failed = await uploadItems(ok);
    failed.forEach((f) => console.log(`  보류  ${fmt(f)} — ${f.problem}`));
    addPending(failed);
  }
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
