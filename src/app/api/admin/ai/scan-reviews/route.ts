import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/config/env';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return apiError('Database unconfigured', 503, 'DB_UNCONFIGURED');

  try {
    const { data: reviews } = await adminClient
      .from('reviews')
      .select('id, review_text, rating')
      .not('review_text', 'is', null)
      .limit(10);

    const reviewItems = (reviews || []).map((r) => ({
      id: r.id,
      text: r.review_text || '',
      rating: r.rating,
    }));

    if (reviewItems.length === 0) {
      return apiSuccess({ scannedCount: 0, flaggedCount: 0, flaggedReviews: [] });
    }

    const flaggedReviews: Array<{ id: string; toxicityReason: string; severity: 'high' | 'medium' }> = [];

    if (env.isConfigured.gemini) {
      try {
        const prompt = `
Analyze the following user reviews from an Indian hyperlocal services marketplace. Identify any that contain abusive, defamatory, threatening, vulgar, or fraudulent text.
Reviews:
${JSON.stringify(reviewItems)}

Respond with JSON format only:
[{"id": "...", "isToxic": true/false, "toxicityReason": "...", "severity": "high"|"medium"}]
`;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        if (response.ok) {
          const resData = await response.json();
          const raw = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            interface GeminiToxicityItem {
              id: string;
              isToxic: boolean;
              toxicityReason: string;
              severity?: 'high' | 'medium';
            }
            const parsed = JSON.parse(raw) as GeminiToxicityItem[];
            parsed.forEach((item) => {
              if (item.isToxic) {
                flaggedReviews.push({
                  id: item.id,
                  toxicityReason: item.toxicityReason,
                  severity: item.severity || 'medium',
                });
              }
            });
          }
        }
      } catch (geminiErr) {
        console.warn('[Gemini AI] Toxicity scan error:', geminiErr);
      }
    }

    // Rule-based heuristic fallback if Gemini is unconfigured or returns empty
    if (flaggedReviews.length === 0) {
      const toxicKeywords = ['cheat', 'fraud', 'scam', 'chor', 'bakwas', 'abuse', 'terrible fake'];
      reviewItems.forEach((r) => {
        const lower = r.text.toLowerCase();
        const matched = toxicKeywords.find((kw) => lower.includes(kw));
        if (matched) {
          flaggedReviews.push({
            id: r.id,
            toxicityReason: `Contains sensitive/abusive trigger keyword: "${matched}"`,
            severity: 'medium',
          });
        }
      });
    }

    // Auto-create review flags for flagged items
    for (const flag of flaggedReviews) {
      await adminClient.from('review_flags').insert({
        review_id: flag.id,
        reason: `[AI Toxicity Scan] ${flag.toxicityReason}`,
        status: 'PENDING',
      });
    }

    return apiSuccess({
      scannedCount: reviewItems.length,
      flaggedCount: flaggedReviews.length,
      flaggedReviews,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Toxicity scan failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}
