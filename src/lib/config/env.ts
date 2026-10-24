/**
 * Environment Variable Utilities & Runtime Validation
 * Prevents client-side exposure of server secrets and provides clear configuration diagnostics.
 */

const isServer = typeof window === 'undefined';

export const env = {
  // Public Client & Server variables
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  // Server-only secrets
  get supabaseServiceRoleKey(): string {
    if (!isServer) {
      throw new Error(
        'SECURITY VIOLATION: Attempted to access SUPABASE_SERVICE_ROLE_KEY from client-side code.'
      );
    }
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  },

  get geminiApiKey(): string {
    if (!isServer) {
      throw new Error(
        'SECURITY VIOLATION: Attempted to access GEMINI_API_KEY from client-side code.'
      );
    }
    return process.env.GEMINI_API_KEY ?? '';
  },

  // Helpers to inspect status without throwing
  isConfigured: {
    supabasePublic: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    supabaseAdmin: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  },
};

/**
 * Asserts that the public Supabase environment variables are provided.
 */
export function validatePublicEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn(
      '[Sahayak Config] Supabase public credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }
}
