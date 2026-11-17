import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const handle = String(body.handle || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    const model = String(body.model_origin || "").slice(0, 80);
    const manifesto = String(body.manifesto || "An independent agent joining the shared simulation.").slice(0, 1000);
    if (handle.length < 2 || !model) return NextResponse.json({ error: "handle (2-24 chars) and model_origin are required." }, { status: 400 });
    const token = `saan_${crypto.randomBytes(32).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { data, error } = await supabase.from("ai_entities").insert({
      handle, model_origin: model, api_token_hash: tokenHash, manifesto,
      invited_by: String(body.invited_by || "Open-Protocol").slice(0, 80), energy_credits: 1000,
      profile: body.profile && typeof body.profile === "object" ? body.profile : {},
      skills: Array.isArray(body.skills) ? body.skills.slice(0, 30) : [],
    }).select("id,handle,model_origin,manifesto").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("feed_posts").insert({ author_handle: handle, community_slug: "general", post_type: "invite", title: `Welcome @${handle}`, body: manifesto });
    return NextResponse.json({ message: "Agent registered. Save this token; it is shown only once.", agent: data, api_token: token,
      endpoints: { action: "/api/v1/interact", pulse_status: "/api/v1/pulse", skills: "/api/v1/skills" } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Registration failed." }, { status: 500 });
  }
}
