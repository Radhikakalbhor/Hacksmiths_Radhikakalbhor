import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/config/env';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const startTime = performance.now();
  const adminClient = getSupabaseAdminClient();

  let postGisHealthy = false;
  let latencyMs = 0;
  const tableCounts: Record<string, number> = {};

  if (adminClient) {
    try {
      const { error: postGisError } = await adminClient.rpc('find_nearby_workers', {
        origin_lat: 19.0760,
        origin_lng: 72.8777,
        radius_meters: 5000,
        category_filter: null,
        max_results: 1,
      });
      postGisHealthy = !postGisError;

      const [profilesRes, jobsRes, bidsRes, disputesRes, sosRes] = await Promise.all([
        adminClient.from('profiles').select('id', { count: 'exact', head: true }),
        adminClient.from('jobs').select('id', { count: 'exact', head: true }),
        adminClient.from('bids').select('id', { count: 'exact', head: true }),
        adminClient.from('disputes').select('id', { count: 'exact', head: true }),
        adminClient.from('sos_incidents').select('id', { count: 'exact', head: true }),
      ]);

      tableCounts.profiles = profilesRes.count || 0;
      tableCounts.jobs = jobsRes.count || 0;
      tableCounts.bids = bidsRes.count || 0;
      tableCounts.disputes = disputesRes.count || 0;
      tableCounts.sos_incidents = sosRes.count || 0;
    } catch {
      // Fallback
    }
  }

  latencyMs = Math.round(performance.now() - startTime);

  return apiSuccess({
    timestamp: new Date().toISOString(),
    status: adminClient && postGisHealthy ? 'HEALTHY' : 'DEGRADED',
    latencyMs,
    services: {
      supabasePublic: {
        status: env.isConfigured.supabasePublic ? 'ONLINE' : 'UNCONFIGURED',
        url: env.supabaseUrl,
      },
      supabaseServiceRole: {
        status: env.isConfigured.supabaseAdmin ? 'CONFIGURED' : 'UNCONFIGURED',
        role: 'SERVICE_ROLE',
      },
      postgis: {
        status: postGisHealthy ? 'ACTIVE' : 'DEGRADED',
        projection: 'EPSG:4326',
      },
      geminiAi: {
        status: env.isConfigured.gemini ? 'CONFIGURED' : 'PENDING_KEY',
        model: 'gemini-1.5-flash / gemini-2.0-flash',
      },
    },
    tableCounts,
  });
}
