# Struktur Modul Backend Godoc

Setiap fitur punya satu folder di `src/modules/<fitur>/`, dan setiap file hanya punya satu tanggung jawab.
Contoh lengkap: [`document-number/`](./document-number).

```
src/
  server.ts                     # bootstrap express + mount router modul
  modules/
    <fitur>/
      <fitur>.routes.ts         # path + urutan middleware (auth, akses, validasi) → controller
      <fitur>.controller.ts     # baca req → panggil service → kirim res. Tidak ada query/logika bisnis.
      <fitur>.service.ts        # logika bisnis & alur (hitung, cek status, panggil email). Tidak menyentuh req/res.
      <fitur>.repository.ts     # query Prisma saja. Tidak ada logika bisnis.
      <fitur>.dto.ts            # skema zod untuk input (body/query/params) + tipe TypeScript-nya
      <fitur>.mail.ts           # (opsional) template HTML & pengiriman email fitur ini
      <fitur>.utils.ts          # (opsional) fungsi murni kecil yang dipakai service
  shared/
    config/                     # env, database (prismaDB1 / prismaDB2), jwt
    middleware/                 # auth (verifyToken, requireRole), documentAccess, validate, upload, error
    mail/mail.service.ts        # transport SMTP + helper email umum (sendEmail, getGreeting, ...)
    utils/http-error.ts         # HttpError(status, body) untuk error non-500 dari service
```

Fitur besar boleh dipecah lagi menjadi sub-folder dengan pola yang sama
(mis. `proposed-changes/approver-change/`, `master-data/department/`).

## Aturan

1. **Routes** menentukan urutan middleware:
   `upload.single()` → middleware yang mengubah input (`scopeList`, `forceSelfQuery`, `bindOwnerFromToken`,
   `bindApproverFromToken`, `stripOwnerFields`) → `validate(Dto, source)` → cek akses (`requireDocAccess`,
   `requireSelfParam`, `requireRole`) → `controller.x`.
2. **Controller** tidak boleh memanggil Prisma. Error dari service:
   `if (error instanceof HttpError) return res.status(error.status).json(error.body)`;
   error lain → 500 dengan body yang sama seperti sebelumnya.
3. **Service** melempar `new HttpError(status, body)` untuk 400/403/404/409, dengan body JSON yang persis
   sama seperti yang dikirim ke client sebelumnya.
4. **Repository** hanya berisi fungsi query Prisma yang diberi nama sesuai maksudnya (`findPage`, `findById`, ...).
5. **DTO**:
   - selalu `z.looseObject(...)`, jadi field tambahan tidak ditolak;
   - field wajib yang dulu dicek dengan `if (!data.x)` → `present<T>("Label")`, semantiknya sama;
   - `validate()` hanya memvalidasi, `req.body` tidak diubah;
   - aturan lintas-field yang rumit tetap di service, dengan pesan yang sama.
6. **Email**: template HTML dan logika "kirim ke siapa" ada di `<fitur>.mail.ts`, dan memakai
   `shared/mail/mail.service.ts` untuk mengirim.
7. Kontrak API tidak boleh berubah: path, method, urutan route, status code, dan body response.
   Buktikan dengan `scripts/route-inventory.ts` (dibandingkan sebelum/sesudah), `scripts/security-smoke.sh`,
   dan `scripts/access-integration-test.js`.
