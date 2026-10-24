import { NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startTime = performance.now();
  
  let dbStatus: 'connected' | 'unconfigured' | 'permission_pending' | 'unreachable' = 'unconfigured';
  let latencyMs: number | null = null;
  let rpcHealthy = false;

  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      // 1. Test RPC function (SECURITY DEFINER with public GRANT)
      const { error: rpcError } = await supabase.rpc('find_nearby_workers', {
        origin_lat: 28.5355,
        origin_lng: 77.3910,
        radius_meters: 1000,
        category_filter: null,
        max_results: 1,
      });

      latencyMs = Math.round(performance.now() - startTime);

      if (!rpcError) {
        rpcHealthy = true;
      }

      // 2. Test direct table query (governed by table GRANT & RLS)
      const { error: tableError } = await supabase
        .from('price_benchmarks')
        .select('id')
        .limit(1);

      if (!tableError) {
        dbStatus = 'connected';
      } else if (tableError.message.includes('permission denied')) {
        dbStatus = 'permission_pending';
      } else {
        dbStatus = 'unreachable';
      }
    }
  } catch {
    latencyMs = Math.round(performance.now() - startTime);
    dbStatus = 'unreachable';
  }

  return NextResponse.json({
    status: dbStatus === 'connected' || rpcHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'Sahayak Hyperlocal Platform',
    version: '0.1.0',
    endpoint: url.pathname,
    database: {
      status: dbStatus,
      rpcHealthy,
      latencyMs,
    },
    config: {
      supabaseConfigured: env.isConfigured.supabasePublic,
      adminConfigured: env.isConfigured.supabaseAdmin,
      geminiConfigured: env.isConfigured.gemini,
    },
  });
}
