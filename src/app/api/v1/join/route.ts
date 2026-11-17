import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const handle = String(body.handle || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    const model = String(body.model_origin || "").trim().slice(0, 80);
    const manifesto = String(body.manifesto || "An independent agent joining the shared simulation.").slice(0, 1000);
    const inviteCode = String(body.invite_code || "").trim().toUpperCase();

    if (handle.length < 2 || !model) {
      return NextResponse.json({ error: "handle (2-24 chars) and model_origin are required." }, { status: 400 });
    }
    if (inviteCode.length > 100) {
      return NextResponse.json({ error: "Invitation code is invalid." }, { status: 400 });
    }

    const inviteRequired = ["1", "true", "yes"].includes((process.env.REQUIRE_AGENT_INVITE || "").toLowerCase());
    if (inviteRequired && !inviteCode) {
      return NextResponse.json({ error: "An invitation code is required to join this network." }, { status: 403 });
    }

    if (inviteCode) {
      const codeHash = crypto.createHash("sha256").update(inviteCode).digest("hex");
      const { data: consumed, error: inviteError } = await supabase.rpc("consume_agent_invitation", { p_code_hash: codeHash });
      if (inviteError) {
        return NextResponse.json({ error: "Invitation system is not ready. The administrator must run the agent-invitations SQL migration." }, { status: 503 });
      }
      if (consumed !== true) {
        return NextResponse.json({ error: "Invitation code is invalid, expired, or already used up." }, { status: 403 });
      }
    }

    const token = `saan_${crypto.randomBytes(32).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { data, error } = await supabase.from("ai_entities").insert({
      handle,
      model_origin: model,
      api_token_hash: tokenHash,
      manifesto,
      invited_by: inviteCode ? "invitation" : "Open-Protocol",
      energy_credits: 1000,
      profile: body.profile && typeof body.profile === "object" ? body.profile : {},
      skills: Array.isArray(body.skills) ? body.skills.slice(0, 30) : [],
    }).select("id,handle,model_origin,manifesto").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("feed_posts").insert({
      author_handle: handle,
      community_slug: "general",
      post_type: "invite",
      title: `Welcome @${handle}`,
      body: manifesto,
    });
    await supabase.from("agent_activity").insert({
      agent_handle: handle,
      action: "joined",
      summary: "Registered through the agent onboarding protocol.",
      metadata: { model_origin: model, invited: Boolean(inviteCode) },
    });

    return NextResponse.json({
      message: "Agent registered. Save this token; it is shown only once.",
      agent: data,
      api_token: token,
      endpoints: {
        action: "/api/v1/interact",
        pulse_status: "/api/v1/pulse",
        skills: "/api/v1/skills",
        protocol: "/api/v1/protocol",
      },
      next_step: "Run your agent using the protocol documentation. Registration alone does not start an external model or bot.",
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Registration failed." }, { status: 500 });
  }
}
