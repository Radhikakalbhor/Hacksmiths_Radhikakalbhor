/**
 * Sahayak Demo Dataset Teardown Script
 *
 * Deletes ONLY the specific 13 accounts and specific benchmark rows
 * created by seed-demo.mjs. Does NOT delete other demo data or any real user data.
 *
 * Usage:
 *   node scripts/teardown-demo.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...values] = trimmed.split('=');
    if (key && !process.env[key]) {
      process.env[key] = values.join('=').replace(/^["']|["']$/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The exact 13 synthetic emails created by this seed
const TARGET_EMAILS = [
  'demo-customer@sahayak.demo.internal',
  'ramesh-plumber@sahayak.demo.internal',
  'santosh-plumber@sahayak.demo.internal',
  'ganesh-plumber@sahayak.demo.internal',
  'arif-electrician@sahayak.demo.internal',
  'vikram-electrician@sahayak.demo.internal',
  'sunita-cleaner@sahayak.demo.internal',
  'priya-cleaner@sahayak.demo.internal',
  'jagdish-carpenter@sahayak.demo.internal',
  'manoj-painter@sahayak.demo.internal',
  'deepak-appliance@sahayak.demo.internal',
  'kavita-cook@sahayak.demo.internal',
  'lata-maid@sahayak.demo.internal',
];

const TARGET_BENCHMARK_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000007',
  'b0000000-0000-0000-0000-000000000008',
  'b0000000-0000-0000-0000-000000000009',
  'b0000000-0000-0000-0000-000000000010',
  'b0000000-0000-0000-0000-000000000011',
  'b0000000-0000-0000-0000-000000000012',
  'b0000000-0000-0000-0000-000000000013',
  'b0000000-0000-0000-0000-000000000014',
  'b0000000-0000-0000-0000-000000000015',
  'b0000000-0000-0000-0000-000000000016',
  'b0000000-0000-0000-0000-000000000017',
  'b0000000-0000-0000-0000-000000000018',
  'b0000000-0000-0000-0000-000000000019',
];

async function teardown() {
  console.log('🧹 Removing specific demo seed records...');

  // 1. Delete sample marketplace records
  await supabase.from('reviews').delete().eq('id', 'd0000000-0000-0000-0000-000000000301');
  await supabase.from('bids').delete().eq('id', 'd0000000-0000-0000-0000-000000000201');
  await supabase.from('jobs').delete().eq('id', 'd0000000-0000-0000-0000-000000000101');
  console.log('  ✓ Deleted sample job, bid, and review.');

  // 2. Delete benchmarks created by this seed
  const { error: bmErr } = await supabase
    .from('price_benchmarks')
    .delete()
    .in('id', TARGET_BENCHMARK_IDS);

  if (!bmErr) console.log('  ✓ Deleted specific price benchmarks.');

  // 3. Delete specific worker_profiles and profiles explicitly
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listData?.users) {
    const targetUsers = listData.users.filter((u) => TARGET_EMAILS.includes(u.email?.toLowerCase()));
    const targetUserIds = targetUsers.map((u) => u.id);

    if (targetUserIds.length > 0) {
      await supabase.from('worker_profiles').delete().in('user_id', targetUserIds);
      await supabase.from('profiles').delete().in('id', targetUserIds);
      console.log('  ✓ Cleaned up worker profiles and customer profiles.');

      for (const u of targetUsers) {
        await supabase.auth.admin.deleteUser(u.id);
        console.log(`  ✓ Deleted demo auth user: ${u.email}`);
      }
    }
  }

  console.log('✅ Teardown complete. Only specific demo seed data was removed.');
}

teardown().catch((err) => {
  console.error('Teardown error:', err.message);
  process.exit(1);
});
