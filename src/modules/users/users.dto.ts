import { z } from "zod";
import { zId } from "../../shared/middleware/validate";

// Body create/update user divalidasi oleh validateUserInput (format 400 lama: { errors: [...] }).
// Cek field wajib createUser tetap di service karena body 400-nya khusus ({ error, missingFields }).

export const UserIdParams = z.looseObject({ id: zId });
