#!/bin/bash
# Smoke test keamanan: jalankan server (npm run dev), lalu: bash scripts/security-smoke.sh  (API_BASE bisa di-override). Token uji ditandatangani dengan JWT_SECRET dari .env.development.
B=${API_BASE:-http://localhost:7777/api}
tok() { node -e 'require("dotenv").config({path:".env.development"});console.log(require("jsonwebtoken").sign(JSON.parse(process.argv[1]),process.env.JWT_SECRET,{expiresIn:"5m"}))' "$1"; }
USER=$(tok '{"auth_id":5,"nik":"E005","role":{"role_name":"User"}}')
ADMIN=$(tok '{"auth_id":2,"nik":"E002","role":{"role_name":"Admin"}}')
SUPER=$(tok '{"auth_id":1,"nik":"E001","role":{"role_name":"Super Admin"}}')
NOAUTH=$(tok '{"nik":"X","role":{"role_name":"User"}}')
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
check() { [ "$2" = "$3" ] && r=PASS || r=FAIL; printf "%-4s %-62s expected %s got %s\n" $r "$1" "$2" "$3"; }
check "POST /users/testing tanpa token"                  403 $(code -XPOST $B/users/testing)
check "POST /users/testing dengan token (route dihapus)"   404 $(code -XPOST $B/users/testing -H "Authorization: Bearer $USER")
check "POST /users/login legacy dengan token (dihapus)"   404 $(code -XPOST $B/users/login -H "Authorization: Bearer $USER" -H 'Content-Type: application/json' -d '{}')
check "GET /users/employees tanpa token"                 403 $(code $B/users/employees)
check "GET /users list oleh user biasa"                  403 $(code $B/users -H "Authorization: Bearer $USER")
check "DELETE /users/1 oleh user biasa"                  403 $(code -XDELETE $B/users/1 -H "Authorization: Bearer $USER")
check "PUT /userGodoc/5 (eskalasi role) oleh user biasa" 403 $(code -XPUT $B/userGodoc/5 -H "Authorization: Bearer $USER" -H 'Content-Type: application/json' -d '{"role_id":1}')
check "POST /departments oleh user biasa"                 403 $(code -XPOST $B/departments -H "Authorization: Bearer $USER" -H 'Content-Type: application/json' -d '{}')
a=$(code -XPOST $B/departments -H "Authorization: Bearer $SUPER" -H 'Content-Type: application/json' -d '{}'); [ "$a" != 403 ] && r=PASS || r=FAIL; printf "%-4s %-62s expected !403 got %s\n" $r "POST /departments oleh Super Admin (lolos gate)" $a
a=$(code -XPOST $B/lines -H "Authorization: Bearer $USER" -H 'Content-Type: application/json' -d '{}'); [ "$a" != 403 ] && r=PASS || r=FAIL; printf "%-4s %-62s expected !403 got %s\n" $r "POST /lines oleh user biasa (alur Document Number)" $a
check "POST /status token tanpa auth_id"                 403 $(code -XPOST $B/status -H "Authorization: Bearer $NOAUTH" -H 'Content-Type: application/json' -d '{"auth_id":1}')
check "POST /authstatus token tanpa auth_id"             403 $(code -XPOST $B/authstatus -H "Authorization: Bearer $NOAUTH" -H 'Content-Type: application/json' -d '{"auth_id":1}')
check "POST /approvalhandover token tanpa auth_id"       403 $(code -XPOST $B/approvalhandover -H "Authorization: Bearer $NOAUTH" -H 'Content-Type: application/json' -d '{"auth_id":1}')
check "GET /proposedchanges tanpa token"                 403 $(code $B/proposedchanges)
last=; for i in $(seq 1 21); do last=$(code -XPOST $B/users/loginUserGodoc -H 'Content-Type: application/json' -d '{"username":"x","password":"demo"}'); done
check "Login ke-21 dari IP sama (rate limit)"            429 $last
check "POST /mastersupportdoc (DOC master) oleh user"     403 $(code -XPOST $B/mastersupportdoc -H "Authorization: Bearer $USER" -H 'Content-Type: application/json' -d '{}')
a=$(code -XPOST $B/mastersupportdoc -H "Authorization: Bearer $SUPER" -H 'Content-Type: application/json' -d '{}'); [ "$a" != 403 ] && r=PASS || r=FAIL; printf "%-4s %-62s expected !403 got %s\n" $r "POST /mastersupportdoc oleh Super Admin" $a
check "POST /departments oleh Admin (bukan Super Admin)"    403 $(code -XPOST $B/departments -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{}')
check "PUT /userGodoc/2 (Admin naik ke Super Admin)"       403 $(code -XPUT $B/userGodoc/2 -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"role_id":1}')
check "GET /users list oleh Admin"                         403 $(code $B/users -H "Authorization: Bearer $ADMIN")
