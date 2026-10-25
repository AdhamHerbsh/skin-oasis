import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const uploadPattern = /^([a-f0-9-]{36}\.(?:png|jpe?g|webp))$/i;

async function getLogoBuffer() {
  const [brand] = await db
    .select({ logoPath: settings.logoPath })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const fileName = brand?.logoPath?.startsWith("/api/uploads/")
    ? brand.logoPath.slice("/api/uploads/".length)
    : "";
  const match = uploadPattern.exec(fileName);

  if (match) {
    const directories = [
      path.resolve(process.cwd(), process.env.UPLOADS_DIR || "data/uploads"),
      path.resolve(process.cwd(), "public/uploads"),
    ];

    for (const directory of directories) {
      try {
        return await readFile(path.resolve(directory, match[1]));
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      }
    }
  }

  return readFile(path.resolve(process.cwd(), "public/pwa-icon.svg"));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: requestedSize } = await params;
  if (requestedSize !== "192" && requestedSize !== "512") {
    return new Response("Not found", { status: 404 });
  }

  const size = Number(requestedSize);
  const icon = await sharp(await getLogoBuffer())
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(icon), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
