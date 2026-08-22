import { NextResponse } from "next/server";
import { readFarmStateFromDatabase, writeFarmStateToDatabase } from "@/lib/dailey-db";
import type { FarmState } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ state: await readFarmStateFromDatabase() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible leer los datos de la granja." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { state?: FarmState };
    if (!body.state) return NextResponse.json({ error: "Falta la información de la granja." }, { status: 400 });
    await writeFarmStateToDatabase(body.state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible guardar los datos de la granja." }, { status: 503 });
  }
}
