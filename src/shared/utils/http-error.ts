/**
 * Error yang dilempar service dengan status & body JSON persis seperti yang dikirim ke client.
 * Controller menangkapnya dan meneruskan apa adanya, jadi kontrak response tidak berubah.
 */
export class HttpError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(String(body.error ?? body.message ?? `HTTP ${status}`));
  }
}
