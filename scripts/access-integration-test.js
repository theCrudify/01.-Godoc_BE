/**
 * Uji integrasi kepemilikan & visibilitas dokumen per role.
 *
 * HANYA untuk database uji kosong — skrip ini MENGHAPUS & mengisi ulang data contoh.
 * Wajib set ACCESS_TEST_DB_URL (database dokumen, mis. mysql://root@127.0.0.1:3399/godoc_documents)
 * dan jalankan server dengan DATABASE_URL_2 yang sama, lalu:
 *
 *   ACCESS_TEST_DB_URL=... API_BASE=http://localhost:7799/api node scripts/access-integration-test.js
 */
require("dotenv").config({ path: ".env.development" });
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("../prisma/generated/db2");

const DB = process.env.ACCESS_TEST_DB_URL;
if (!DB || /godoc_documents\b/.test(DB) === false || DB === process.env.DATABASE_URL_2) {
  console.error("Refusing to run: set ACCESS_TEST_DB_URL to a dedicated *test* godoc_documents database (not the one in .env).");
  process.exit(2);
}
const API = process.env.API_BASE || "http://localhost:7799/api";
const db = new PrismaClient({ datasources: { db: { url: DB } } });

// Persona: auth_id → { role, dept, nik }
const P = {
  superAdmin: { id: 1, role: "Super Admin", dept: 1 },
  adminDept1: { id: 2, role: "Admin", dept: 1 },
  adminDept2: { id: 3, role: "Admin", dept: 2 },
  owner: { id: 10, role: "User", dept: 1 },
  pcApprover: { id: 11, role: "User", dept: 2 },
  authdocApprover: { id: 12, role: "User", dept: 2 },
  authdocMember: { id: 13, role: "User", dept: 2 },
  handoverParticipant: { id: 14, role: "User", dept: 2 },
  handoverApprover: { id: 15, role: "User", dept: 2 },
  outsiderOtherDept: { id: 16, role: "User", dept: 2 },
  outsiderSameDept: { id: 17, role: "User", dept: 1 },
};
const nik = (id) => `E${String(id).padStart(3, "0")}`;

async function seed() {
  const t = ["tr_proposed_changes_history", "tr_handover_history", "tr_authdoc_history", "tr_document_number", "tr_handover_approval", "tr_handover", "tr_authdoc_member", "tr_authdoc_approval", "tr_authorization_doc",
    "tbl_support_document_file", "tbl_support_document", "tr_proposed_changes_approval", "tr_proposed_changes",
    "mst_authorization", "mst_department", "mst_role"];
  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
  for (const name of t) await db.$executeRawUnsafe(`DELETE FROM ${name}`);
  await db.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");

  await db.mst_role.createMany({ data: [{ id: 1, role_name: "Super Admin" }, { id: 2, role_name: "Admin" }, { id: 3, role_name: "User" }] });
  await db.mst_department.createMany({ data: [{ id: 1, department_name: "Dept 1", department_code: "D1" }, { id: 2, department_name: "Dept 2", department_code: "D2" }] });
  const roleId = { "Super Admin": 1, Admin: 2, User: 3 };
  await db.mst_authorization.createMany({
    data: Object.values(P).map((p) => ({ id: p.id, employee_code: nik(p.id), employee_name: `P${p.id}`, department_id: p.dept, role_id: roleId[p.role] })),
  });
  await db.tr_proposed_changes.createMany({
    data: [
      { id: 100, project_name: "PC owner dept1", auth_id: P.owner.id, department_id: 1 },
      { id: 101, project_name: "PC outsider dept2", auth_id: P.outsiderOtherDept.id, department_id: 2 },
      // 102: belum punya authdoc → muncul di list Proposed Changes (100 sudah naik ke tahap Authorization)
      { id: 102, project_name: "PC owner dept1 (stage PC)", auth_id: P.owner.id, department_id: 1 },
    ],
  });
  await db.tr_proposed_changes_approval.create({ data: { proposed_changes_id: 100, auth_id: P.pcApprover.id, step: 1, status: "on_going" } });
  await db.tr_authorization_doc.create({ data: { id: 200, proposed_change_id: 100, auth_id: P.owner.id, department_id: 1 } });
  await db.tr_authdoc_approval.create({ data: { authdoc_id: 200, auth_id: P.authdocApprover.id, step: 1 } });
  await db.tr_authdoc_member.create({ data: { authdoc_id: 200, employee_code: nik(P.authdocMember.id), is_deleted: false } });
  await db.tr_handover.create({ data: { id: 300, proposed_change_id: 100, authdoc_id: 200, auth_id: P.owner.id, auth_id2: P.handoverParticipant.id, department_id: 1 } });
  await db.tr_handover_approval.create({ data: { handover_id: 300, auth_id: P.handoverApprover.id, step: 1 } });
  await db.tbl_support_document.create({ data: { id: 400, proposed_id: 100 } });
  await db.tbl_support_document_file.create({ data: { id: 500, support_doc_id: 400, file: "missing.pdf" } });
}

const token = (p) => jwt.sign(
  { auth_id: p.id, nik: nik(p.id), name: `P${p.id}`, role: { id: 0, role_name: p.role }, department: { id: p.dept } },
  process.env.JWT_SECRET, { expiresIn: "10m" });

const call = async (p, method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token(p)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json };
};

let pass = 0, fail = 0;
const expect = (label, ok, detail) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  → ${detail}`}`);
};
const allowed = async (who, method, path, body) => {
  const r = await call(P[who], method, path, body);
  expect(`${who.padEnd(20)} ${method} ${path} boleh`, r.status !== 403, `status ${r.status}`);
};
const denied = async (who, method, path, body) => {
  const r = await call(P[who], method, path, body);
  expect(`${who.padEnd(20)} ${method} ${path} ditolak`, r.status === 403, `status ${r.status}`);
};
const rowsOf = (j) => j?.data ?? j?.rows ?? j?.items ?? (Array.isArray(j) ? j : []);

(async () => {
  await seed();

  // Detail Proposed Changes (read): pemilik, semua yang terlibat di rantai, admin departemennya, super admin
  for (const w of ["superAdmin", "adminDept1", "owner", "pcApprover", "authdocApprover", "authdocMember", "handoverParticipant", "handoverApprover"])
    await allowed(w, "GET", "/proposedchanges/100");
  for (const w of ["adminDept2", "outsiderOtherDept", "outsiderSameDept"]) await denied(w, "GET", "/proposedchanges/100");

  // File pendukung mengikuti aturan PC
  await allowed("pcApprover", "GET", "/support-docs/file/500/view");
  await denied("outsiderSameDept", "GET", "/support-docs/file/500/download");

  // Manage (ubah/hapus): pemilik, admin departemennya, super admin — approver TIDAK
  for (const w of ["superAdmin", "adminDept1", "owner"]) await allowed(w, "PUT", "/supportdocuments/100/status", []);
  for (const w of ["pcApprover", "adminDept2", "outsiderSameDept"]) await denied(w, "PUT", "/supportdocuments/100/status", []);
  await denied("pcApprover", "DELETE", "/proposedchanges/100");

  // Authorization doc & handover detail
  await allowed("authdocMember", "GET", "/authdoc/200");
  await denied("outsiderOtherDept", "GET", "/authdoc/200");
  await allowed("handoverParticipant", "GET", "/handover/300");
  await allowed("handoverApprover", "GET", "/handover/300");
  await denied("outsiderOtherDept", "GET", "/handover/300");
  await denied("outsiderOtherDept", "POST", "/handover/300/rate", { rating: 5 });

  // Path param auth_id harus milik sendiri
  await denied("outsiderOtherDept", "GET", `/completionapprover/${P.handoverApprover.id}`);
  await allowed("handoverApprover", "GET", `/completionapprover/${P.handoverApprover.id}`);

  // Approver change request: hanya pemilik dokumen
  await denied("pcApprover", "POST", "/approver-change/request", { proposed_changes_id: 100 });

  // List: user dipaksa ke miliknya walau minta auth_id orang lain
  let r = await call(P.outsiderOtherDept, "GET", `/proposedchanges?auth_id=${P.owner.id}&page=1&limit=50`);
  let ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC user (minta milik orang lain) → hanya miliknya", r.status === 200 && ids.includes(101) && !ids.includes(102), `status ${r.status} ids ${ids}`);
  // Admin departemen 2 tanpa filter → hanya dept 2
  r = await call(P.adminDept2, "GET", "/proposedchanges?page=1&limit=50");
  ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC Admin dept2 → hanya dept 2", r.status === 200 && ids.includes(101) && !ids.includes(102), `status ${r.status} ids ${ids}`);
  // Admin dept2 mencoba department_id=1 → tetap dept 2
  r = await call(P.adminDept2, "GET", "/proposedchanges?department_id=1&page=1&limit=50");
  ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC Admin dept2 minta dept1 → tetap dept 2", r.status === 200 && !ids.includes(102), `status ${r.status} ids ${ids}`);
  // Admin dept1 tanpa filter → dept 1
  r = await call(P.adminDept1, "GET", "/proposedchanges?page=1&limit=50");
  ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC Admin dept1 → hanya dept 1", r.status === 200 && ids.includes(102) && !ids.includes(101), `status ${r.status} ids ${ids}`);
  // Pemilik melihat list miliknya
  r = await call(P.owner, "GET", `/proposedchanges?auth_id=${P.owner.id}&page=1&limit=50`);
  ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC pemilik → miliknya muncul", r.status === 200 && ids.includes(102) && !ids.includes(101), `status ${r.status} ids ${ids}`);
  // Super Admin → semua (yang masih di tahap PC)
  r = await call(P.superAdmin, "GET", "/proposedchanges?page=1&limit=50");
  ids = rowsOf(r.json).map((x) => x.id);
  expect("list PC Super Admin → semua", r.status === 200 && ids.includes(102) && ids.includes(101) && !ids.includes(100), `status ${r.status} ids ${ids}`);
  // Daftar "harus saya approve": dipaksa diri sendiri
  r = await call(P.outsiderOtherDept, "GET", `/ongoing?approval_auth_id=${P.pcApprover.id}&page=1&limit=50`);
  ids = rowsOf(r.json).map((x) => x.id);
  expect("ongoing approvals user lain → tidak bocor", r.status === 200 && !ids.includes(100), `status ${r.status} ids ${ids}`);
  r = await call(P.pcApprover, "GET", `/ongoing?approval_auth_id=${P.pcApprover.id}&page=1&limit=50`);
  ids = rowsOf(r.json).map((x) => x.id);
  expect("ongoing approvals milik sendiri → muncul", r.status === 200 && ids.includes(100), `status ${r.status} ids ${ids} body ${JSON.stringify(r.json).slice(0, 200)}`);

  // ---- Alur (setelah refactor): edit tidak memindahkan kepemilikan, history mencatat pengedit sebenarnya ----
  r = await call(P.owner, "PUT", "/proposedchanges/102", { project_name: "edit by owner", auth_id: P.outsiderOtherDept.id });
  let pc = await db.tr_proposed_changes.findUnique({ where: { id: 102 } });
  let hist = await db.tr_proposed_changes_history.findFirst({ where: { proposed_changes_id: 102 }, orderBy: { id: "desc" } });
  expect("PUT PC oleh pemilik → 200, nama berubah", r.status === 200 && pc?.project_name === "edit by owner", `status ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  expect("PUT PC: auth_id kiriman client diabaikan (pemilik tetap)", pc?.auth_id === P.owner.id, `auth_id ${pc?.auth_id}`);
  expect("PUT PC: history mencatat pengedit (pemilik)", hist?.auth_id === P.owner.id && hist?.employee_code === nik(P.owner.id), JSON.stringify(hist));

  r = await call(P.adminDept1, "PUT", "/proposedchanges/102", { project_name: "edit by admin" });
  pc = await db.tr_proposed_changes.findUnique({ where: { id: 102 } });
  hist = await db.tr_proposed_changes_history.findFirst({ where: { proposed_changes_id: 102 }, orderBy: { id: "desc" } });
  expect("PUT PC oleh Admin dept → 200, pemilik tidak pindah ke admin", r.status === 200 && pc?.auth_id === P.owner.id, `status ${r.status} auth_id ${pc?.auth_id}`);
  expect("PUT PC oleh Admin: history mencatat admin", hist?.auth_id === P.adminDept1.id, JSON.stringify(hist));

  r = await call(P.handoverApprover, "PUT", "/handover/300", { remark: "cek approver" });
  const ho = await db.tr_handover.findUnique({ where: { id: 300 } });
  const hh = await db.tr_handover_history.findFirst({ where: { handover_id: 300 }, orderBy: { id: "desc" } });
  expect("PUT handover oleh approver → 200, remark tersimpan", r.status === 200 && ho?.remark === "cek approver", `status ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  expect("PUT handover: history mencatat approver, pemilik tetap", hh?.auth_id === P.handoverApprover.id && ho?.auth_id === P.owner.id, `hist ${hh?.auth_id} owner ${ho?.auth_id}`);

  r = await call(P.authdocApprover, "PUT", "/authdoc/200", { description: "cek authdoc" });
  const ad = await db.tr_authorization_doc.findUnique({ where: { id: 200 } });
  expect("PUT authdoc oleh approver → 200, pemilik tidak pindah", r.status === 200 && ad?.auth_id === P.owner.id, `status ${r.status} owner ${ad?.auth_id} ${JSON.stringify(r.json).slice(0, 200)}`);

  // Validasi DTO: field wajib kosong → 400; body lengkap → 201 dengan running number
  r = await call(P.owner, "POST", "/documentnumbers", { line_code: "L1" });
  expect("POST document number tanpa field wajib → 400", r.status === 400, `status ${r.status}`);
  r = await call(P.owner, "GET", "/documentnumbers/abc");
  expect("GET document number id bukan angka → 400", r.status === 400, `status ${r.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
