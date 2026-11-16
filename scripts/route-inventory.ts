/**
 * Cetak semua route yang terdaftar (method, path, jumlah middleware) dari app Express.
 * Dipakai untuk membuktikan refactor tidak mengubah permukaan API:
 *   npx ts-node --transpile-only scripts/route-inventory.ts > before.txt   (lalu bandingkan dengan after)
 */
process.env.PORT = "0";
const express = require("express");
const origListen = express.application.listen;
let app: any;
express.application.listen = function (this: any, ...args: any[]) {
  app = this;
  const srv = origListen.apply(this, args);
  setImmediate(() => {
    const out: string[] = [];
    const walk = (stack: any[], prefix: string) => {
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(",");
          out.push(`${methods} ${prefix}${layer.route.path} [${layer.route.stack.length}]`);
        } else if (layer.name === "router" && layer.handle?.stack) {
          const m = layer.regexp?.source.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)/);
          const p = m ? "/" + m[1].replace(/\\\//g, "/") : "";
          walk(layer.handle.stack, prefix + p);
        }
      }
    };
    walk(app._router.stack, "");
    process.stdout.write(out.join("\n") + "\n");
    process.exit(0);
  });
  return srv;
};
require("../src/server");
