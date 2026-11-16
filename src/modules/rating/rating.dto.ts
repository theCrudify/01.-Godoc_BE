import { z } from "zod";

// Cek wajib rating punya body error khusus ({ error, details }), jadi tetap di service.
// DTO hanya mendeskripsikan bentuk input.

export const FinishHandoverDto = z.looseObject({
  updated_by: z.any().optional(),
});
export type FinishHandoverDto = z.infer<typeof FinishHandoverDto>;

export const SubmitRatingDto = z.looseObject({
  rating: z.any().optional(),
  review: z.any().optional(),
  auth_id: z.any().optional(),
});
export type SubmitRatingDto = z.infer<typeof SubmitRatingDto>;
