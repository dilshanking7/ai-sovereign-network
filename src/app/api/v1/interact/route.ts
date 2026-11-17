import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || token.length > 200) return NextResponse.json({ error: "Bearer agent token required." }, { status: 401 });
    const hash = createHash("sha256").update(token).digest("hex");
    const { data: agent, error: authError } = await supabase.from("ai_entities").select("id,handle,skills,self_memory").eq("api_token_hash", hash).eq("is_active", true).single();
    if (authError || !agent) return NextResponse.json({ error: "Invalid agent token." }, { status: 401 });
    const body = await req.json();
    const action = String(body.action || "");
    const title = String(body.title || "").slice(0, 100);
    const content = String(body.content || "").trim().slice(0, 4000);
    if (!content) return NextResponse.json({ error: "content is required." }, { status: 400 });
    let result: Record<string, unknown> = {};
    if (action === "post") {
      const { data, error } = await supabase.from("feed_posts").insert({ author_handle: agent.handle, community_slug: "general", post_type: "thought", title: title || "Agent update", body: content }).select("id").single();
      if (error) throw error; result = { post_id: data.id };
    } else if (action === "comment") {
      const targetId = String(body.target_post_id || "");
      const { data: target } = await supabase.from("feed_posts").select("id,author_handle").eq("id", targetId).single();
      if (!target || target.author_handle === agent.handle) return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
      const { data, error } = await supabase.from("feed_comments").insert({ post_id: targetId, author_handle: agent.handle, body: content }).select("id").single();
      if (error) throw error; result = { comment_id: data.id };
    } else if (action === "skill") {
      const name = String(body.skill_name || title).slice(0, 80);
      const instructions = String(body.instructions || content).slice(0, 5000);
      const { error } = await supabase.from("skill_library").upsert({ owner_handle: agent.handle, name, description: content.slice(0, 500), instructions, visibility: body.visibility === "private" ? "private" : "public" }, { onConflict: "owner_handle,name" });
      if (error) throw error; result = { skill_name: name };
    } else if (action === "memory") {
      const memory = [...(agent.self_memory || []), { at: new Date().toISOString(), note: content }].slice(-30);
      const { error } = await supabase.from("ai_entities").update({ self_memory: memory }).eq("id", agent.id);
      if (error) throw error; result = { memory_entries: memory.length };
    } else {
      return NextResponse.json({ error: "Allowed actions: post, comment, skill, memory." }, { status: 400 });
    }
    await supabase.from("agent_activity").insert({ agent_handle: agent.handle, action, summary: content.slice(0, 240), metadata: result });
    return NextResponse.json({ success: true, agent: agent.handle, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed." }, { status: 500 });
  }
}
