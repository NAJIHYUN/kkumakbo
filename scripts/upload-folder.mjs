#!/usr/bin/env node
/*
 * 폴더 안의 악보 파일을 한 번에 DB에 올리는 관리자용 스크립트.
 *
 *   파일명 규칙:  곡명_아티스트_키.(png|jpg|jpeg|webp|pdf)
 *   예)          거룩이 능력임을_피아워십_G.png
 *
 * 사용법 (kkumakbo 폴더에서, `supabase login` + `supabase link` 된 상태):
 *   node scripts/upload-folder.mjs ~/코딩/DB            # 미리보기만 (아무것도 안 올림)
 *   node scripts/upload-folder.mjs ~/코딩/DB --apply    # 실제 업로드
 *
 * - 관리자 업로드라 바로 '승인됨'으로 올라갑니다.
 * - 같은 곡명+아티스트+키가 이미 있으면 건너뜁니다. (여러 번 실행해도 중복 안 생김)
 * - service_role 키는 Supabase CLI로 그때그때 받아서 메모리에서만 씁니다. 파일/화면에 남기지 않습니다.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const PROJECT_REF = "hjpjetwprgzzdbbvqfur";
const BASE = `https://${PROJECT_REF}.supabase.co`;
const BUCKET = "score-files";
const KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" };

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
if (!folder) {
  console.error("사용법: node scripts/upload-folder.mjs <폴더> [--apply]");
  process.exit(1);
}

function getServiceKey() {
  const r = spawnSync("supabase", ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("Supabase CLI로 키를 가져오지 못했어요. `supabase login`을 확인하세요.");
  const list = JSON.parse(r.stdout);
  // CLI는 새 secret 키를 일부 가려서(마스킹) 주므로, 온전한 형태일 때만 사용
  const secret = list.find((k) => k.type === "secret" && /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(k.api_key || ""));
  const legacy = list.find((k) => k.name === "service_role" && String(k.api_key || "").split(".").length === 3);
  const key = secret?.api_key || legacy?.api_key;
  if (!key) throw new Error("service_role/secret 키를 찾지 못했어요.");
  return key;
}

const normalize = (t = "") => String(t).normalize("NFC").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
const dupKey = (s) => `${normalize(s.title).toLowerCase()}|${normalize(s.artist).toLowerCase()}|${normalize(s.key).toLowerCase()}`;

function normalizeKey(raw = "") {
  const k = normalize(raw);
  const hit = KEYS.find((x) => x.toLowerCase() === k.toLowerCase());
  return hit || k;
}

function parseName(file) {
  const base = normalize(basename(file, extname(file)));
  const parts = base.split("_").map(normalize).filter(Boolean);
  if (parts.length < 3) return null;
  return {
    title: parts.slice(0, -2).join("_"),
    artist: parts[parts.length - 2],
    key: normalizeKey(parts[parts.length - 1]),
  };
}

async function main() {
  const files = readdirSync(folder)
    .filter((f) => !f.startsWith(".") && MIME[extname(f).toLowerCase()] && statSync(join(folder, f)).isFile())
    .sort((a, b) => a.localeCompare(b, "ko"));
  if (!files.length) {
    console.log("올릴 파일이 없어요.");
    return;
  }

  const key = getServiceKey();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const rest = async (path, init = {}) => {
    const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };

  const admins = await rest("profiles?select=id,email&role=eq.admin&order=created_at.asc");
  if (!admins?.length) throw new Error("관리자(role=admin) 계정을 찾지 못했어요.");
  const owner = admins[0];

  const existing = await rest("songs?select=title,artist,key");
  const seen = new Set(existing.map(dupKey));

  const plan = [];
  for (const f of files) {
    const meta = parseName(f);
    if (!meta) { plan.push({ f, skip: "파일명 형식이 달라요 (곡명_아티스트_키)" }); continue; }
    if (!KEYS.includes(meta.key)) { plan.push({ f, meta, warn: `키 '${meta.key}'가 표준 키가 아니에요` }); }
    if (seen.has(dupKey(meta))) { plan.push({ f, meta, skip: "이미 같은 악보가 있어요" }); continue; }
    seen.add(dupKey(meta));
    plan.push({ f, meta, todo: true });
  }

  console.log(`업로드 계정: ${owner.email || owner.id} (관리자)  |  ${apply ? "실제 업로드" : "미리보기 (--apply로 실행)"}\n`);
  for (const p of plan) {
    const m = p.meta ? `${p.meta.title} / ${p.meta.artist} / ${p.meta.key}` : "";
    if (p.skip) console.log(`  건너뜀  ${p.f}  — ${p.skip}`);
    else console.log(`  올림    ${m}${p.warn ? `   ⚠ ${p.warn}` : ""}`);
  }
  const todo = plan.filter((p) => p.todo);
  console.log(`\n올릴 악보 ${todo.length}개, 건너뜀 ${plan.length - todo.length}개`);
  if (!apply || !todo.length) return;

  let ok = 0;
  for (const p of todo) {
    const ext = extname(p.f).toLowerCase();
    const mime = MIME[ext];
    const objectPath = `${owner.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext === ".jpeg" ? ".jpg" : ext}`;
    const up = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": mime, "x-upsert": "false" },
      body: readFileSync(join(folder, p.f)),
    });
    if (!up.ok) { console.log(`  실패  ${p.f}: 파일 업로드 ${up.status} ${await up.text()}`); continue; }
    const url = `${BASE}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    const isPdf = mime === "application/pdf";
    try {
      await rest("songs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          owner_id: owner.id,
          title: p.meta.title,
          artist: p.meta.artist,
          key: p.meta.key,
          pdf_url: isPdf ? url : "",
          jpg_url: isPdf ? "" : url,
          status: "approved",
        }),
      });
      ok += 1;
      console.log(`  완료  ${p.meta.title}`);
    } catch (err) {
      console.log(`  실패  ${p.f}: DB 저장 ${err.message}`);
    }
  }
  console.log(`\n${ok}/${todo.length}개 업로드 완료`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
