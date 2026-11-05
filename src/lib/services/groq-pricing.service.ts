/**
 * Groq AI Integration for Sahayak Fair Pricing Engine
 *
 * Responsibilities:
 * 1. Understands customer job description and title in natural language (English/Hinglish).
 * 2. Classifies task complexity into: 'simple' | 'moderate' | 'complex'.
 * 3. Identifies detected problem and whether replacement parts/materials are likely required.
 *
 * Strict Architectural Safeguards:
 * - AI NEVER calculates or invents prices. All pricing is computed strictly by the rule-based pricing engine.
 * - Server-side only: GROQ_API_KEY is never exposed to the client browser.
 * - Secrets are NEVER logged.
 * - Validates AI response structure strictly.
 * - Automatic graceful fallback to rule-based classification if Groq is unavailable, rate-limited, or errors.
 */

import { TaskComplexity } from '@/lib/config/pricing-config';

export interface GroqTaskClassification {
  serviceCategory: string;
  detectedProblem: string;
  complexity: TaskComplexity;
  materialsLikely: boolean;
  briefAnalysis: string;
  modelUsed: string;
}

// Supported Groq models on account, prioritized by latency and structured output capabilities
export const SUPPORTED_GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

/**
 * Validates and sanitizes raw JSON output from Groq.
 * Ensures complexity is strictly 'simple' | 'moderate' | 'complex'.
 */
export function validateGroqClassification(
  raw: unknown,
  modelName: string
): GroqTaskClassification | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // 1. Normalize complexity
  const rawComplexity = String(obj.complexity || obj.complexityLevel || '').toLowerCase().trim();
  let complexity: TaskComplexity = 'simple';

  if (rawComplexity === 'complex' || rawComplexity === 'hard' || rawComplexity === 'high' || rawComplexity === 'heavy') {
    complexity = 'complex';
  } else if (rawComplexity === 'moderate' || rawComplexity === 'medium' || rawComplexity === 'average' || rawComplexity === 'intermediate') {
    complexity = 'moderate';
  } else if (rawComplexity === 'simple' || rawComplexity === 'low' || rawComplexity === 'easy' || rawComplexity === 'minor') {
    complexity = 'simple';
  } else {
    // Default safe fallback if unexpected string
    complexity = 'moderate';
  }

  // 2. Normalize materialsLikely
  let materialsLikely = false;
  if (typeof obj.materialsLikely === 'boolean') {
    materialsLikely = obj.materialsLikely;
  } else if (Array.isArray(obj.materialsLikely)) {
    materialsLikely = obj.materialsLikely.length > 0;
  } else if (typeof obj.materialsLikely === 'string') {
    materialsLikely = obj.materialsLikely.toLowerCase() === 'true' || obj.materialsLikely.toLowerCase() === 'yes';
  }

  // 3. Extract detected problem & service category
  const detectedProblem = typeof obj.detectedProblem === 'string' && obj.detectedProblem.trim().length > 0
    ? obj.detectedProblem.trim().slice(0, 120)
    : 'Identified household issue';

  const serviceCategory = typeof obj.serviceCategory === 'string' && obj.serviceCategory.trim().length > 0
    ? obj.serviceCategory.trim().toLowerCase()
    : typeof obj.service === 'string' && obj.service.trim().length > 0
    ? obj.service.trim().toLowerCase()
    : 'general';

  const briefAnalysis = typeof obj.briefAnalysis === 'string' && obj.briefAnalysis.trim().length > 0
    ? obj.briefAnalysis.trim().slice(0, 180)
    : typeof obj.summary === 'string'
    ? obj.summary.trim().slice(0, 180)
    : `${complexity.toUpperCase()} complexity ${serviceCategory} service task`;

  return {
    serviceCategory,
    detectedProblem,
    complexity,
    materialsLikely,
    briefAnalysis,
    modelUsed: modelName,
  };
}

/**
 * Calls Groq API server-side using GROQ_API_KEY.
 * Never throws an uncaught error - returns null on any failure, rate limit, or invalid response.
 */
export async function callGroqClassification(
  category: string,
  title: string,
  description?: string
): Promise<GroqTaskClassification | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  // If no API key configured, return null gracefully (caller uses rule-based fallback)
  if (!apiKey) {
    return null;
  }

  const prompt = `You are an expert home services assessment engine for Sahayak (India).
Analyze this customer service request:
- Service Category: ${category}
- Job Title: ${title}
- Description: ${description || 'None provided'}

Classify the work into one of these 3 complexity levels:
- "simple": Basic routine fix, inspection, minor washer/switch replacement, single spot dusting (< 1 hour).
- "moderate": Standard repair, drain clear, ceiling fan repair, single fixture replacement (1–2 hours).
- "complex": Deep renovation, concealed pipe leak, rewiring, multi-room deep clean, overhaul (> 2 hours).

Also identify:
- "detectedProblem": Concise summary of the specific issue (e.g. "Continuous tap leakage at spindle")
- "materialsLikely": true if replacement parts/materials/chemicals are likely needed, else false.
- "briefAnalysis": 1-sentence explanation of the work required.

Return ONLY a JSON object with this exact structure:
{
  "serviceCategory": "${category}",
  "detectedProblem": "...",
  "complexity": "simple" | "moderate" | "complex",
  "materialsLikely": true | false,
  "briefAnalysis": "..."
}`;

  // Try supported models in sequence
  for (const model of SUPPORTED_GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast UI response

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert home services triage engine. Output strictly valid JSON matching the user schema.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 250,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // Safe logging without printing API key or sensitive data
        console.warn(`[GroqPricing] Model ${model} returned HTTP ${res.status}. Trying next option.`);
        continue;
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      const validated = validateGroqClassification(parsed, model);
      if (validated) {
        return validated;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[GroqPricing] Error communicating with Groq (${model}): ${errMsg}.`);
    }
  }

  // If all models failed or timed out, return null to activate rule-based fallback
  return null;
}

