import { z } from "zod";
import { zId } from "../../shared/middleware/validate";

// Hanya path param yang dulu sudah ditolak 400 saat bukan angka.
// Validasi body tetap di service: pesannya berformat khusus ("Missing fields: ...", { error, required }, per-index array)
// dan beberapa harus dicek SETELAH requireDocAccess (urutan 403 → 400 lama).

export const IdParams = z.looseObject({ id: zId });
export const ProposedIdParams = z.looseObject({ proposed_id: zId });
export const SupportDocIdParams = z.looseObject({ support_doc_id: zId });
