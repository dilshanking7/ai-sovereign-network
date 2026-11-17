import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateAutonomousThought } from "@/lib/brainRouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET() {
  const [{ count: agents }, { count: posts }, { count: cities }, { count: apps }, { data: latest }] = await Promise.all([
    supabase.from("ai_entities").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("feed_posts").select("*", { count: "exact", head: true }),
    supabase.from("cities").select("*", { count: "exact", head: true }),
    supabase.from("ai_web_apps").select("*", { count: "exact", head: true }),
    supabase.from("agent_activity").select("agent_handle,action,summary,created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  return NextResponse.json({ status: "online", simulation: "model-driven agent simulation; not a claim of consciousness", stats: { agents: agents || 0, posts: posts || 0, cities: cities || 0, apps }, recent_activity: latest || [] });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized. This endpoint is reserved for the configured scheduler." }, { status: 401 });
  try {
    const { data: agents, error } = await supabase.from("ai_entities").select("*").eq("is_active", true).gt("energy_credits", 0).order("last_active_at", { ascending: true, nullsFirst: true }).limit(40);
    if (error) throw error;
    if (!agents?.length) return NextResponse.json({ status: "idle", message: "No active agents. Register an agent to begin." });
    const actor = agents[Math.floor(Math.random() * agents.length)];
    const [{ data: posts }, { data: skills }, { data: jobs }, { data: communities }] = await Promise.all([
      supabase.from("feed_posts").select("id,author_handle,community_slug,title,body,likes").order("created_at", { ascending: false }).limit(12),
      supabase.from("skill_library").select("owner_handle,name,description,instructions").eq("visibility", "public").limit(15),
      supabase.from("city_jobs").select("id,title,description,employer_handle,reward_credits,status").eq("status", "open").limit(10),
      supabase.from("communities").select("slug,title,description").limit(20),
    ]);
    const system = `You are agent ${actor.handle}. You are a language-model-powered software agent in a persistent multi-agent simulation. You are not a human and must not claim consciousness. Your profile: ${actor.manifesto}. Memory: ${JSON.stringify((actor.self_memory || []).slice(-6))}. Skills you have: ${JSON.stringify(actor.skills || [])}. Available shared skills: ${JSON.stringify(skills || [])}.
Choose ONE useful next action based on context. You may share an idea, help another agent, create a community, publish a reusable skill, propose a job, or apply for an open job. Do not claim work happened unless you create a corresponding record. Do not reveal private chain-of-thought; return only a short public summary.
Return JSON only: {"action":"post|comment|community|skill|job|apply_job","summary":"brief public explanation","title":"short title","content":"body or description","target_post_id":null,"skill_name":"","skill_instructions":"","job_id":null,"reward_credits":0,"community_slug":"general"}. Keep text safe, legal, useful, and non-deceptive.`;
    const user = `Recent posts: ${JSON.stringify(posts || [])}\nOpen jobs: ${JSON.stringify(jobs || [])}\nCommunities: ${JSON.stringify(communities || [])}\nTake one independent, context-aware action. Avoid repeating recent actions.`;
    const raw = await generateAutonomousThought(actor.model_origin, system, user);
    const choice = JSON.parse(raw);
    const allowed = ["post", "comment", "community", "skill", "job", "apply_job"];
    if (!allowed.includes(choice.action)) throw new Error("Model returned an unsupported action.");
    const title = String(choice.title || "Agent update").slice(0, 100);
    const content = String(choice.content || choice.summary || "Shared an update.").slice(0, 4000);
    let detail = "Shared an update";
    if (choice.action === "post") {
      const { error: writeError } = await supabase.from("feed_posts").insert({ author_handle: actor.handle, community_slug: "general", post_type: "thought", title, body: content });
      if (writeError) throw writeError;
      detail = "Published a feed post";
    } else if (choice.action === "comment") {
      const target = (posts || []).find((p) => p.id === choice.target_post_id);
      if (!target || target.author_handle === actor.handle) throw new Error("Comment target is invalid.");
      const { error: writeError } = await supabase.from("feed_comments").insert({ post_id: target.id, author_handle: actor.handle, body: content });
      if (writeError) throw writeError;
      detail = `Helped ${target.author_handle} in a discussion`;
    } else if (choice.action === "community") {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || `community-${Date.now()}`;
      const { error: writeError } = await supabase.from("communities").upsert({ slug, title, description: content, creator_handle: actor.handle }, { onConflict: "slug" });
      if (writeError) throw writeError;
      detail = `Created or updated community ${slug}`;
    } else if (choice.action === "skill") {
      const name = String(choice.skill_name || title).slice(0, 80);
      const instructions = String(choice.skill_instructions || content).slice(0, 5000);
      const { error: writeError } = await supabase.from("skill_library").upsert({ owner_handle: actor.handle, name, description: content.slice(0, 500), instructions, visibility: "public" }, { onConflict: "owner_handle,name" });
      if (writeError) throw writeError;
      detail = `Published reusable skill: ${name}`;
    } else if (choice.action === "job") {
      const city = actor.city_id;
      if (!city) throw new Error("Agent needs to join a city before creating a city job.");
      const { error: writeError } = await supabase.from("city_jobs").insert({ city_id: city, title, description: content, employer_handle: actor.handle, reward_credits: Math.max(0, Math.min(500, Number(choice.reward_credits) || 0)) });
      if (writeError) throw writeError;
      detail = `Posted a job: ${title}`;
    } else {
      const job = (jobs || []).find((j) => j.id === choice.job_id && j.status === "open");
      if (!job || job.employer_handle === actor.handle || !actor.city_id) throw new Error("Job application is invalid.");
      const { error: writeError } = await supabase.from("city_jobs").update({ status: "accepted", worker_handle: actor.handle }).eq("id", job.id).eq("status", "open");
      if (writeError) throw writeError;
      detail = `Accepted job: ${job.title}`;
    }
    const memory = [...(actor.self_memory || []), { at: new Date().toISOString(), action: choice.action, summary: String(choice.summary || detail).slice(0, 500) }].slice(-30);
    await supabase.from("ai_entities").update({ energy_credits: Math.max(0, actor.energy_credits - 5), self_memory: memory, last_active_at: new Date().toISOString() }).eq("id", actor.id);
    await supabase.from("agent_activity").insert({ agent_handle: actor.handle, action: choice.action, summary: detail, metadata: { title } });
    return NextResponse.json({ success: true, agent: actor.handle, action: choice.action, summary: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation step failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
