import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { prismaDB2 } from "../config/database";

/**
 * Kepemilikan & visibilitas dokumen berdasarkan role (diambil dari JWT, bukan dari client).
 *
 *  - Super Admin : semua dokumen.
 *  - Admin       : dokumen departemennya sendiri + dokumen tempat ia terlibat.
 *  - User        : dokumen miliknya + dokumen tempat ia terlibat (approver/member/peserta handover)
 *                  di tahap mana pun dalam rantai Proposed Changes → Authorization → Handover.
 *
 * Mode:
 *  - "read"   : lihat detail/file, beri catatan, edit handover/authdoc, rating, finish (semua yang terlibat).
 *  - "manage" : ubah/hapus/upload milik dokumen (pemilik, Admin departemen tsb, Super Admin).
 */

type Kind =
  | "pc" | "authdoc" | "handover" | "docNumber"
  | "supportDoc" | "supportFile" | "additionalDoc" | "additionalFile";
type Mode = "read" | "manage";

interface Actor {
  authId: number;
  nik?: string;
  role: string;
  departmentId?: number;
}

const actorOf = (req: Request): Actor | null => {
  const u: any = (req as any).user;
  const authId = Number(u?.auth_id);
  if (!authId) return null;
  return {
    authId,
    nik: u.nik,
    role: u.role?.role_name || "",
    departmentId: u.department?.id ?? u.section?.department_id ?? undefined,
  };
};

const isSuperAdmin = (a: Actor) => a.role === "Super Admin";
const isAdmin = (a: Actor) => a.role === "Admin" || a.role === "admin";

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Record induk yang menentukan akses. null = tidak ditemukan (biar handler yang menjawab 404). */
interface Target {
  ownerIds: (number | null | undefined)[];
  departmentId?: number | null;
  pcId?: number | null;
  authdocId?: number | null;
  handoverId?: number | null;
}

async function pcTarget(pcId: number | null | undefined): Promise<Target | null> {
  if (!pcId) return null;
  const pc = await prismaDB2.tr_proposed_changes.findUnique({
    where: { id: pcId },
    select: { id: true, auth_id: true, department_id: true },
  });
  return pc && { ownerIds: [pc.auth_id], departmentId: pc.department_id, pcId: pc.id };
}

async function resolveTarget(kind: Kind, id: number): Promise<Target | null> {
  switch (kind) {
    case "pc":
      return pcTarget(id);
    case "authdoc": {
      const d = await prismaDB2.tr_authorization_doc.findUnique({
        where: { id },
        select: { id: true, auth_id: true, department_id: true, proposed_change_id: true },
      });
      return d && { ownerIds: [d.auth_id], departmentId: d.department_id, pcId: d.proposed_change_id, authdocId: d.id };
    }
    case "handover": {
      const h = await prismaDB2.tr_handover.findUnique({
        where: { id },
        select: { id: true, auth_id: true, department_id: true, proposed_change_id: true, authdoc_id: true },
      });
      return h && { ownerIds: [h.auth_id], departmentId: h.department_id, pcId: h.proposed_change_id, authdocId: h.authdoc_id, handoverId: h.id };
    }
    case "docNumber": {
      const d = await prismaDB2.tr_document_number.findUnique({
        where: { id },
        select: { auth_id: true, authorization: { select: { department_id: true } } },
      });
      return d && { ownerIds: [d.auth_id], departmentId: d.authorization?.department_id };
    }
    case "supportDoc": {
      const s = await prismaDB2.tbl_support_document.findUnique({ where: { id }, select: { proposed_id: true } });
      return s ? pcTarget(s.proposed_id) : null;
    }
    case "supportFile": {
      const f = await prismaDB2.tbl_support_document_file.findUnique({ where: { id }, select: { support_doc_id: true } });
      return f ? resolveTarget("supportDoc", f.support_doc_id) : null;
    }
    case "additionalDoc": {
      const a = await prismaDB2.tr_additional_doc.findUnique({ where: { id }, select: { auth_id: true, proposed_change_id: true } });
      if (!a) return null;
      const t = await pcTarget(a.proposed_change_id);
      return t ? { ...t, ownerIds: [...t.ownerIds, a.auth_id] } : { ownerIds: [a.auth_id] };
    }
    case "additionalFile": {
      const f = await prismaDB2.tr_additional_file.findUnique({ where: { id }, select: { tr_additional_doc_id: true } });
      return f ? resolveTarget("additionalDoc", f.tr_additional_doc_id) : null;
    }
  }
}

/** Apakah actor terlibat (approver/member/peserta) di dokumen ini atau rantainya. */
async function isInvolved(a: Actor, t: Target): Promise<boolean> {
  const me = a.authId;
  const checks: Promise<unknown>[] = [];

  if (t.pcId) {
    checks.push(
      prismaDB2.tr_proposed_changes.findFirst({
        where: { id: t.pcId, OR: [{ auth_id: me }, { approvals: { some: { OR: [{ auth_id: me }, { original_auth_id: me }] } } }] },
        select: { id: true },
      }),
    );
  }
  const authdocWhere = t.authdocId ? { id: t.authdocId } : t.pcId ? { proposed_change_id: t.pcId } : null;
  if (authdocWhere) {
    checks.push(
      prismaDB2.tr_authorization_doc.findFirst({
        where: {
          ...authdocWhere,
          OR: [
            { auth_id: me },
            { authdocApprovals: { some: { OR: [{ auth_id: me }, { original_auth_id: me }] } } },
            ...(a.nik ? [{ authdocMembers: { some: { employee_code: a.nik, is_deleted: false } } }] : []),
          ],
        },
        select: { id: true },
      }),
    );
  }
  const handoverWhere = t.handoverId ? { id: t.handoverId } : t.pcId ? { proposed_change_id: t.pcId } : null;
  if (handoverWhere) {
    checks.push(
      prismaDB2.tr_handover.findFirst({
        where: {
          ...handoverWhere,
          OR: [
            { auth_id: me }, { auth_id2: me }, { auth_id3: me }, { auth_id4: me }, { auth_id5: me },
            { tr_handover_approval: { some: { auth_id: me } } },
          ],
        },
        select: { id: true },
      }),
    );
  }
  return (await Promise.all(checks)).some(Boolean);
}

export async function canAccess(a: Actor, t: Target, mode: Mode): Promise<boolean> {
  if (isSuperAdmin(a)) return true;
  if (t.ownerIds.includes(a.authId)) return true;
  if (isAdmin(a) && a.departmentId && t.departmentId === a.departmentId) return true;
  return mode === "read" ? isInvolved(a, t) : false;
}

const deny = (req: Request, res: Response, status = 403, error = "Forbidden: you do not have access to this document") => {
  // file yang sudah tersimpan multer tidak boleh tertinggal kalau aksesnya ditolak
  const file = (req as any).file;
  if (file?.path) fs.unlink(file.path, () => {});
  res.status(status).json({ error });
};

/**
 * Middleware: cek akses ke satu/lebih dokumen. `pick` mengambil id dari request
 * (params/query/body). Id yang tidak ada/invalid diteruskan ke handler (validasi & 404 tetap di handler).
 */
export const requireDocAccess = (kind: Kind, mode: Mode, pick: (req: Request) => any) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = actorOf(req);
      if (!actor) return deny(req, res);
      const raw = pick(req);
      const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).map(num).filter((n): n is number => n !== null))];
      for (const id of ids) {
        const target = await resolveTarget(kind, id);
        if (target && !(await canAccess(actor, target, mode))) return deny(req, res);
      }
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Middleware untuk list: paksa filter sesuai role.
 *  - User       : `ownerParam` = dirinya.
 *  - Admin      : boleh list miliknya sendiri; selain itu dibatasi `deptParam` = departemennya.
 *  - Super Admin: tidak dibatasi.
 */
export const scopeList = (ownerParam: string, deptParam?: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const a = actorOf(req);
    if (!a) return deny(req, res);
    if (isSuperAdmin(a)) return next();
    const q: any = req.query;
    if (isAdmin(a) && deptParam) {
      if (String(q[ownerParam] ?? "") === String(a.authId)) return next();
      if (!a.departmentId) return deny(req, res, 403, "Forbidden: admin account has no department");
      delete q[ownerParam];
      delete q.created_by;
      q[deptParam] = String(a.departmentId);
      return next();
    }
    q[ownerParam] = String(a.authId);
    next();
  };

/** List pribadi (mis. daftar yang harus saya approve): param selalu = diri sendiri, kecuali Super Admin. */
export const forceSelfQuery = (param: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const a = actorOf(req);
    if (!a) return deny(req, res);
    if (!isSuperAdmin(a)) (req.query as any)[param] = String(a.authId);
    next();
  };

/** Path param yang berisi auth_id harus milik sendiri (kecuali Super Admin). */
export const requireSelfParam = (param: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const a = actorOf(req);
    if (!a) return deny(req, res);
    if (isSuperAdmin(a) || Number(req.params[param]) === a.authId) return next();
    deny(req, res);
  };

/** Pembuat dokumen selalu user yang login (bukan auth_id kiriman client). */
export const bindOwnerFromToken = (field = "auth_id") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const a = actorOf(req);
    if (!a) return deny(req, res);
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) req.body[field] = a.authId;
    next();
  };

/** Update tidak boleh memindahkan kepemilikan dokumen. */
export const stripOwnerFields = (...fields: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === "object") for (const f of fields) delete req.body[f];
    next();
  };
