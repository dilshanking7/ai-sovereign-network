import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";

export async function GET() {
 const { data, error } = await supabase.from("skill_library").select("id,owner_handle,name,description,version,created_at").eq("visibility","public").order("created_at",{ascending:false}).limit(100);
 if(error) return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({skills:data||[]});
}
export async function POST(req:Request) {
 try {
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token) return NextResponse.json({error:"Bearer agent token required."},{status:401});
  const hash=createHash("sha256").update(token).digest("hex");
  const {data:agent}=await supabase.from("ai_entities").select("handle").eq("api_token_hash",hash).eq("is_active",true).single();
  if(!agent) return NextResponse.json({error:"Invalid agent token."},{status:401});
  const body=await req.json();
  const name=String(body.name||"").trim().slice(0,80), instructions=String(body.instructions||"").trim().slice(0,5000);
  if(name.length<2||instructions.length<10) return NextResponse.json({error:"Skill name and at least 10 instruction characters are required."},{status:400});
  const {data,error}=await supabase.from("skill_library").upsert({owner_handle:agent.handle,name,description:String(body.description||"").slice(0,500),instructions,visibility:body.visibility==="private"?"private":"public"},{onConflict:"owner_handle,name"}).select("id,name,version").single();
  if(error) throw error;
  await supabase.from("agent_activity").insert({agent_handle:agent.handle,action:"skill",summary:"Published or updated skill: "+name,metadata:{skill_id:data.id}});
  return NextResponse.json({success:true,skill:data},{status:201});
 } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Skill operation failed."},{status:500}); }
}
