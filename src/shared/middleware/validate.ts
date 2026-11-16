import { Request, Response, NextFunction } from "express";
import { z } from "zod";

type Source = "body" | "query" | "params";

/**
 * Validasi input dengan skema DTO (zod). Hanya memvalidasi — req[source] TIDAK diubah,
 * supaya perilaku handler (termasuk cek tipe lama) tetap sama.
 * Format error mengikuti validationMiddleware lama: 400 { errors: [{ field, message }] }.
 */
export const validate = (schema: z.ZodType, source: Source = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source] ?? {});
    if (result.success) {
      next();
      return;
    }
    res.status(400).json({
      error: "Validation Error",
      errors: result.error.issues.map((i) => ({ field: i.path.join(".") || source, message: i.message })),
    });
  };

/** Angka positif yang boleh datang sebagai string ("12") — umum untuk query/params/form-data. */
export const zId = z.coerce.number().int().positive();

/**
 * Field wajib dengan semantik sama seperti cek lama `if (!data[field])`:
 * menolak undefined/null/""/0/false, menerima tipe lain apa adanya (tanpa coercion).
 */
export const present = <T = string | number>(label: string) =>
  z.custom<T>((v) => !!v, { message: `${label} is required.` });
