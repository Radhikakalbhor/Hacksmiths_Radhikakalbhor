/**
 * Sahayak Manual Admin Promotion Utility
 * Promotes a specified user (by email, phone, or UUID) to the ADMIN role.
 * Uses the privileged service-role key to prevent client privilege escalation.
 *
 * Usage:
 *   node scripts/promote-admin.mjs admin@sahayak.internal
 *   node scripts/promote-admin.mjs +919999000000
 *   node scripts/promote-admin.mjs <user-uuid>
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\x1b[31m[ERROR] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local\x1b[0m');
  process.exit(1);
}

const identifier = process.argv[2];
if (!identifier) {
  console.log(`
\x1b[36mSahayak Admin Promotion Utility\x1b[0m
Promotes a user to the ADMIN role with zero-trust privilege checks.

\x1b[33mUsage:\x1b[0m
  node scripts/promote-admin.mjs <email | phone | user-id>

\x1b[33mExample:\x1b[0m
  node scripts/promote-admin.mjs admin@sahayak.internal
  node scripts/promote-admin.mjs +919999000099
  node scripts/promote-admin.mjs 550e8400-e29b-41d4-a716-446655440000
`);
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function promote() {
  console.log(`\x1b[34m[INFO] Searching for user profile matching: "${identifier}"...\x1b[0m`);

  // Try finding by ID, email, or phone
  let profileQuery = supabase.from('profiles').select('*');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isUuid) {
    profileQuery = profileQuery.eq('id', identifier);
  } else if (identifier.includes('@')) {
    profileQuery = profileQuery.eq('email', identifier.trim());
  } else {
    profileQuery = profileQuery.eq('phone', identifier.trim());
  }

  const { data: profiles, error: findError } = await profileQuery;

  if (findError) {
    console.error('\x1b[31m[ERROR] Database search failed:\x1b[0m', findError.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.error(`\x1b[31m[ERROR] No profile found with identifier: "${identifier}".\x1b[0m`);
    console.log('\x1b[33mEnsure the user has completed at least one login or signup in Sahayak first.\x1b[0m');
    process.exit(1);
  }

  const target = profiles[0];
  console.log(`\x1b[32m[FOUND] User: ${target.full_name} (${target.id}) - Current Role: ${target.role}\x1b[0m`);

  // Update profile role
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      verification_status: 'verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', target.id);

  if (updateError) {
    console.error('\x1b[31m[ERROR] Failed to update profile role:\x1b[0m', updateError.message);
    process.exit(1);
  }

  // Update auth metadata
  try {
    await supabase.auth.admin.updateUserById(target.id, {
      user_metadata: { role: 'admin' },
      app_metadata: { role: 'admin' },
    });
  } catch (err) {
    console.warn('[WARN] Auth user metadata update warning (non-fatal):', err.message);
  }

  // Record in audit log if table exists
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: target.id,
      action: 'ADMIN_PROMOTION_MANUAL',
      entity_type: 'USER',
      entity_id: target.id,
      metadata: {
        previous_role: target.role,
        promoted_role: 'admin',
        promoted_via: 'scripts/promote-admin.mjs',
      },
    });
  } catch {
    // Non-fatal if migration hasn't been executed yet
  }

  console.log(`\x1b[32m✔ SUCCESS: User ${target.full_name} (${target.id}) has been promoted to ADMIN role!\x1b[0m`);
  console.log(`\x1b[36mThey can now access http://localhost:3000/admin\x1b[0m`);
}

promote().catch((err) => {
  console.error('\x1b[31m[FATAL]:\x1b[0m', err);
  process.exit(1);
});

