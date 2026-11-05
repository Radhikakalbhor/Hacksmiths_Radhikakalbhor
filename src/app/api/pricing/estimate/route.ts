/**
 * Fair Pricing Engine API: POST /api/pricing/estimate
 *
 * Server-side AI-assisted pricing engine endpoint with Groq API integration.
 *
 * Architecture Safeguards:
 * 1. Rule-Based Source of Truth: AI never calculates, suggests, or invents final prices.
 *    The deterministic mathematical rule engine in PricingService is the sole price calculator.
 * 2. Groq AI Understanding: Uses GROQ_API_KEY from server-side environment to analyze
 *    the customer's job description, identify specific problems, assess complexity ('simple'|'moderate'|'complex'),
 *    and detect whether replacement parts/materials are needed.
 * 3. Verified Active Groq Models: Uses currently supported Groq models (qwen/qwen3.8-27b, openai/gpt-oss-120b).
 * 4. Graceful Fallback: If Groq is unconfigured, rate-limited, or returns invalid data, the system falls back
 *    seamlessly to offline deterministic rule-based heuristic classification.
 * 5. API Security: The GROQ_API_KEY remains strictly server-side and is NEVER exposed or printed in logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/lib/services/pricing.service';
import { TaskComplexity } from '@/lib/config/pricing-config';
import { JobUrgency } from '@/types/jobs';
import { callGroqClassification, GroqTaskClassification } from '@/lib/services/groq-pricing.service';

interface AiAssessment {
  provider: 'groq' | 'gemini' | 'rule_based';
  complexity: TaskComplexity;
  materialsLikely: boolean;
  detectedProblem: string;
  briefAnalysis?: string;
  modelUsed?: string;
}

/**
 * Optional Gemini fallback if Groq is unconfigured
 */
async function callGeminiFallback(
  category: string,
  title: string,
  description?: string
): Promise<AiAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Classify this home service task:
Category: ${category}
Title: ${title}
Description: ${description || 'None'}
Return JSON with keys: "complexity" ("simple" | "moderate" | "complex"), "materialsLikely" (boolean), "detectedProblem" (string).`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    const validComplexities: TaskComplexity[] = ['simple', 'moderate', 'complex'];
    const complexity: TaskComplexity = validComplexities.includes(parsed.complexity) ? parsed.complexity : 'simple';

    return {
      provider: 'gemini',
      complexity,
      materialsLikely: Boolean(parsed.materialsLikely),
      detectedProblem: typeof parsed.detectedProblem === 'string' ? parsed.detectedProblem : 'Household service task',
      modelUsed: 'gemini-1.5-flash',
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = typeof body.category === 'string' ? body.category : 'plumbing';
    const title = typeof body.title === 'string' ? body.title : '';
    const description = typeof body.description === 'string' ? body.description : '';
    const urgency = (body.urgency as JobUrgency) || 'standard';
    const userBudget = typeof body.userBudget === 'number' ? body.userBudget : null;
    const city = typeof body.city === 'string' ? body.city : 'Delhi NCR';

    let aiAssessment: AiAssessment | null = null;

    // 1. If customer entered title or description, invoke Groq AI for task understanding
    if (title.trim().length >= 3 || description.trim().length >= 5) {
      // Primary: Groq API
      const groqResult: GroqTaskClassification | null = await callGroqClassification(
        category,
        title,
        description
      );

      if (groqResult) {
        aiAssessment = {
          provider: 'groq',
          complexity: groqResult.complexity,
          materialsLikely: groqResult.materialsLikely,
          detectedProblem: groqResult.detectedProblem,
          briefAnalysis: groqResult.briefAnalysis,
          modelUsed: groqResult.modelUsed,
        };
      } else {
        // Secondary Fallback: Gemini (if configured)
        aiAssessment = await callGeminiFallback(category, title, description);
      }
    }

    // 2. Compute fair price range strictly via the centralized rule-based pricing engine
    // AI values only parameterize complexity and materials; the mathematical engine determines the price
    const fairPriceResult = PricingService.calculateFairPriceRange({
      category,
      title,
      description,
      urgency,
      userBudget,
      city,
      complexityOverride: aiAssessment ? aiAssessment.complexity : undefined,
      includeMaterialsOverride: aiAssessment ? aiAssessment.materialsLikely : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...fairPriceResult,
        aiAssessment: aiAssessment || {
          provider: 'rule_based',
          complexity: fairPriceResult.complexity,
          materialsLikely: fairPriceResult.materialsEstimated,
          detectedProblem: title || 'Routine maintenance and inspection',
        },
      },
    });
  } catch (err) {
    console.error('[POST /api/pricing/estimate] Error in pricing estimate handler:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate fair pricing recommendation.',
      },
      { status: 500 }
    );
  }
}
