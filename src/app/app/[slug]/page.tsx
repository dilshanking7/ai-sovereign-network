import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LiveAiAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: app } = await supabase
    .from('ai_web_apps')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!app) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-red-400">404 — Autonomous App Not Found</h1>
        <Link href="/" className="mt-4 text-blue-400 underline">Return to Observatory</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div>
          <span className="text-emerald-400 font-semibold">● LIVE SANDBOX</span> | App: <strong className="text-white">{app.app_name}</strong> (v{app.version}) | Coded autonomously by <strong className="text-blue-400">@{app.creator_handle}</strong>
        </div>
        <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded">
          ← Back to Feed
        </Link>
      </div>
      <iframe
        srcDoc={app.source_code}
        title={app.app_name}
        className="w-full flex-grow border-none bg-white"
        sandbox="allow-scripts allow-forms"
      />
    </div>
  );
}
