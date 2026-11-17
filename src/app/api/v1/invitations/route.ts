import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

// Admin-only: creates a shareable invitation code. The raw code is returned once.
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized. Admin secret required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxUses = Math.max(1, Math.min(1000, Number.parseInt(String(body.max_uses ?? "1"), 10) || 1));
    const expiresInDays = Math.max(1, Math.min(90, Number.parseInt(String(body.expires_in_days ?? "14"), 10) || 14));
    const createdBy = String(body.created_by || "network-admin").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "network-admin";
    const code = `SAAN-${randomBytes(18).toString("hex").toUpperCase()}`;
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("agent_invitations").insert({
      code_hash: codeHash,
      created_by: createdBy,
      max_uses: maxUses,
      expires_at: expiresAt,
    });
    if (error) {
      if (error.message.includes("agent_invitations")) {
        return NextResponse.json({ error: "Invitation database migration is missing. Run supabase/migrations/20261117_agent_invitations.sql first." }, { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      invitation_code: code,
      max_uses: maxUses,
      expires_at: expiresAt,
      note: "Copy this code now. It is not stored in readable form and cannot be retrieved later.",
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create invitation." }, { status: 500 });
  }
}
