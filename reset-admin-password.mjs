import { createRequire } from "node:module";
import { resolve } from "node:path";

const moduleRoots = [
  resolve(process.env.PROJECT_ROOT, "build/windows-payload"),
  resolve(process.env.PROJECT_ROOT, ".next-packaging/standalone"),
  resolve(process.env.PROJECT_ROOT),
];

let argon2;
let pg;

for (const root of moduleRoots) {
  const candidate = createRequire(resolve(root, "package.json"));

  try {
    // تحميل المكتبتين فعليًا للتأكد من اكتمال ملفاتهما التابعة.
    argon2 = candidate("argon2");
    pg = candidate("pg");
    break;
  } catch {
    // جرّب مجلد المكتبات التالي.
  }
}

if (!argon2 || !pg) {
  throw new Error("Could not load the bundled argon2 and pg modules.");
}

const { hash } = argon2;
const password = process.env.NEW_ADMIN_PASSWORD;

if (!password || password.length < 14) {
  throw new Error("Password must be at least 14 characters.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  const result = await client.query(
    "UPDATE users SET password_hash = $1 WHERE username = 'admin'",
    [await hash(password)]
  );

  if (result.rowCount !== 1) {
    throw new Error("Admin account not found. Start the ERP once, then retry.");
  }

  console.log("Admin password reset. Existing ERP data was not changed.");
} finally {
  await client.end();
}