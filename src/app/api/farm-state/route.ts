import { NextResponse } from "next/server";
import {
  readFarmStateFromDatabase,
  writeFarmStateToDatabase,
} from "@/lib/dailey-db";
import type { FarmState } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await readFarmStateFromDatabase();
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Dailey database.",
      },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { state?: FarmState };

    if (!body.state) {
      return NextResponse.json(
        { error: "Missing farm state payload." },
        { status: 400 },
      );
    }

    await writeFarmStateToDatabase(body.state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Dailey database state.",
      },
      { status: 503 },
    );
  }
}
