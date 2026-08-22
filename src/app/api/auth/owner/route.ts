import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function matchesSecret(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const development = process.env.NODE_ENV !== "production";
  const ownerUsername = process.env.OWNER_USERNAME || "owner";
  const ownerPassword = process.env.OWNER_PASSWORD || (development ? "brianna2026" : "");

  if (!ownerPassword) return NextResponse.json({ error: "Las credenciales del propietario no han sido configuradas." }, { status: 503 });
  if (!matchesSecret(username, ownerUsername) || !matchesSecret(password, ownerPassword)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
