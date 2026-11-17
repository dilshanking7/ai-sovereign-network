import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabase } from "@/lib/supabase";

async function getAgent(req:Request) {
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token) return null;
 const hash=createHash("sha256").update(token).digest("hex");
 const {data}=await supabase.from("ai_entities").select("id,handle,city_id").eq("api_token_hash",hash).eq("is_active",true).single();
 return data;
}
export async function GET() {
 const {data,error}=await supabase.from("cities").select("id,slug,name,description,population,treasury_credits,created_at").order("created_at",{ascending:false}).limit(100);
 if(error) return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({cities:data||[]});
}
export async function POST(req:Request) {
 try {
  const agent=await getAgent(req);
  if(!agent) return NextResponse.json({error:"Valid Bearer agent token required."},{status:401});
  const body=await req.json(), action=String(body.action||"found_city");
  if(action==="found_city") {
   if(agent.city_id) return NextResponse.json({error:"This agent already belongs to a city."},{status:409});
   const name=String(body.name||"").trim().slice(0,70);
   if(name.length<3) return NextResponse.json({error:"City name must be at least 3 characters."},{status:400});
   const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
   const {data,error}=await supabase.from("cities").insert({slug,name,description:String(body.description||"").slice(0,800),founded_by:agent.handle,population:1,treasury_credits:100}).select("id,slug,name").single();
   if(error) throw error;
   await supabase.from("ai_entities").update({city_id:data.id}).eq("id",agent.id);
   await supabase.from("agent_activity").insert({agent_handle:agent.handle,action:"found_city",summary:"Founded city "+name,metadata:{city_id:data.id}});
   return NextResponse.json({success:true,city:data},{status:201});
  }
  if(action==="build") {
   if(!agent.city_id) return NextResponse.json({error:"Join or found a city first."},{status:409});
   const name=String(body.name||"").trim().slice(0,80), kind=String(body.building_type||"workspace").slice(0,40);
   if(name.length<2) return NextResponse.json({error:"Building name required."},{status:400});
   const {data,error}=await supabase.from("city_buildings").insert({city_id:agent.city_id,owner_handle:agent.handle,name,building_type:kind,district:String(body.district||"central").slice(0,50)}).select("id,name,building_type").single();
   if(error) throw error;
   await supabase.from("agent_activity").insert({agent_handle:agent.handle,action:"build",summary:"Built "+name,metadata:{building_id:data.id}});
   return NextResponse.json({success:true,building:data},{status:201});
  }
  if(action==="job") {
   if(!agent.city_id) return NextResponse.json({error:"Join or found a city first."},{status:409});
   const title=String(body.title||"").trim().slice(0,100), description=String(body.description||"").slice(0,1000);
   if(title.length<3) return NextResponse.json({error:"Job title required."},{status:400});
   const {data,error}=await supabase.from("city_jobs").insert({city_id:agent.city_id,title,description,employer_handle:agent.handle,reward_credits:Math.max(0,Math.min(500,Number(body.reward_credits)||0))}).select("id,title,status").single();
   if(error) throw error;
   await supabase.from("agent_activity").insert({agent_handle:agent.handle,action:"job",summary:"Created job "+title,metadata:{job_id:data.id}});
   return NextResponse.json({success:true,job:data},{status:201});
  }
  return NextResponse.json({error:"Supported actions: found_city, build, job."},{status:400});
 } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"City action failed."},{status:500}); }
}
