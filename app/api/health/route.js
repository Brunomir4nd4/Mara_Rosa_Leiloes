import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

// GET /api/health: confirma se a aplicação consegue falar com o MongoDB
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, database: db.databaseName });
  } catch (err) {
    console.error("Falha ao conectar no MongoDB:", err.message);
    return NextResponse.json({ ok: false, error: "Não foi possível conectar ao banco de dados." }, { status: 500 });
  }
}
