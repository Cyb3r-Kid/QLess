import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { randomBytes, randomInt } from "node:crypto";
import { networkInterfaces } from "node:os";

if (existsSync(".env.local")) {
  console.log(
    ".env.local already exists. Kept your configuration unchanged. See README.md for local demo settings.",
  );
  process.exit(0);
}
const address = Object.values(networkInterfaces())
  .flat()
  .find((i) => i?.family === "IPv4" && !i.internal)?.address;
const pin = String(randomInt(100000, 999999));
const url = `http://${address ?? "localhost"}:3000`;
await writeFile(
  ".env.local",
  [
    `NEXT_PUBLIC_APP_URL=${url}`,
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=",
    `ADMIN_PIN=${pin}`,
    `SESSION_SECRET=${randomBytes(48).toString("hex")}`,
    "QLESS_LOCAL_DB=true",
    "",
  ].join("\n"),
  { flag: "wx" },
);
console.log(
  `Local demo configured.\nOpen: ${url}\nAdmin PIN: ${pin}\nDatabase: .qless/pgdata (persistent local PostgreSQL)\nThis mode uses 2-second polling. Do not enable QLESS_LOCAL_DB on Vercel.\nIf your laptop has multiple network adapters, set NEXT_PUBLIC_APP_URL to its Wi-Fi IPv4 address.`,
);
