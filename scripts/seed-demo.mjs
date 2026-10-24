/**
 * Sahayak Demo Dataset Seeding Script
 * Hyperlocal Household Services Marketplace
 *
 * Safe, idempotent provisioning using the official Supabase Auth Admin API
 * and privileged server-side service-role client.
 *
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Never prints or leaks credentials
 * - Fictional identities clearly marked with [DEMO]
 * - government_id_verified and background_check_verified set to FALSE
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 *   node scripts/seed-demo.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { validateSeedPayload } from './seed-validation.mjs';

// 1. Data Specification: 1 Fictional Customer + 12 Fictional Mumbai Workers
const DEMO_CUSTOMER = {
  email: 'demo-customer@sahayak.demo.internal',
  phone: '+919999000099',
  fullName: '[DEMO] Ananya Deshmukh',
  avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  role: 'customer',
  city: 'Mumbai',
};

const DEMO_WORKERS = [
  // Plumbing (3)
  {
    email: 'ramesh-plumber@sahayak.demo.internal',
    phone: '+919999000001',
    fullName: '[DEMO] Ramesh Kumar',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    primaryCategory: 'plumbing',
    skills: ['Pipe Fitting', 'Leak Detection', 'Drain Cleaning', 'Tap Repair', 'Geyser Fitting'],
    bio: '[DEMO] Master plumber with 8+ years experience in Bandra, Khar, and Santa Cruz. Fast response for leakage emergencies. (Fictional profile for demonstration only).',
    yearsExperience: 8,
    serviceRadiusKm: 12.0,
    hourlyRateInr: 350.0,
    fixedRateEstimateInr: 500.0,
    reputationScore: 4.9,
    totalCompletedJobs: 42,
    locality: 'Bandra West',
    lat: 19.0596,
    lng: 72.8295,
  },
  {
    email: 'santosh-plumber@sahayak.demo.internal',
    phone: '+919999000002',
    fullName: '[DEMO] Santosh Shinde',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    primaryCategory: 'plumbing',
    skills: ['Sanitary Installation', 'Water Tank Cleaning', 'Pipe Replacement', 'Flush Repair'],
    bio: '[DEMO] Reliable plumbing specialist serving Dadar, Matunga, and Prabhadevi. (Fictional profile for demonstration only).',
    yearsExperience: 5,
    serviceRadiusKm: 10.0,
    hourlyRateInr: 300.0,
    fixedRateEstimateInr: 450.0,
    reputationScore: 4.8,
    totalCompletedJobs: 28,
    locality: 'Dadar West',
    lat: 19.0178,
    lng: 72.8478,
  },
  {
    email: 'ganesh-plumber@sahayak.demo.internal',
    phone: '+919999000003',
    fullName: '[DEMO] Ganesh Patil',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    primaryCategory: 'plumbing',
    skills: ['Bathroom Renovation', 'Clogged Drains', 'Geyser Installation', 'Motor Servicing'],
    bio: '[DEMO] Veteran plumbing technician in Andheri & Vile Parle. Expert in residential water pressure overhauls. (Fictional profile for demonstration only).',
    yearsExperience: 11,
    serviceRadiusKm: 15.0,
    hourlyRateInr: 400.0,
    fixedRateEstimateInr: 600.0,
    reputationScore: 4.95,
    totalCompletedJobs: 67,
    locality: 'Andheri East',
    lat: 19.1136,
    lng: 72.8697,
  },

  // Electrical (2)
  {
    email: 'arif-electrician@sahayak.demo.internal',
    phone: '+919999000004',
    fullName: '[DEMO] Arif Khan',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    primaryCategory: 'electrical',
    skills: ['Short Circuit Repair', 'MCB Tripping', 'Switchboard Repair', 'Fan Installation'],
    bio: '[DEMO] Licensed wireman in Kurla & BKC. Prompt resolution of domestic power cutoffs and circuit faults. (Fictional profile for demonstration only).',
    yearsExperience: 6,
    serviceRadiusKm: 10.0,
    hourlyRateInr: 350.0,
    fixedRateEstimateInr: 450.0,
    reputationScore: 4.8,
    totalCompletedJobs: 34,
    locality: 'Kurla West',
    lat: 19.0726,
    lng: 72.8845,
  },
  {
    email: 'vikram-electrician@sahayak.demo.internal',
    phone: '+919999000005',
    fullName: '[DEMO] Vikramaditya Sharma',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    primaryCategory: 'electrical',
    skills: ['Inverter Setup', 'Complete Home Rewiring', 'Appliance Power Line', 'Chandelier Installation'],
    bio: '[DEMO] Experienced electrician serving Powai and Vikhroli residential high-rises. (Fictional profile for demonstration only).',
    yearsExperience: 9,
    serviceRadiusKm: 14.0,
    hourlyRateInr: 450.0,
    fixedRateEstimateInr: 700.0,
    reputationScore: 4.9,
    totalCompletedJobs: 51,
    locality: 'Powai',
    lat: 19.1176,
    lng: 72.906,
  },

  // Deep Cleaning (2)
  {
    email: 'sunita-cleaner@sahayak.demo.internal',
    phone: '+919999000006',
    fullName: '[DEMO] Sunita Jadhav',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    primaryCategory: 'cleaning',
    skills: ['Deep Kitchen Cleaning', 'Bathroom Disinfection', 'Sofa Shampooing', 'Balcony Scrubbing'],
    bio: '[DEMO] Home deep cleaning professional across South Mumbai and Worli. Uses non-toxic eco agents. (Fictional profile for demonstration only).',
    yearsExperience: 4,
    serviceRadiusKm: 10.0,
    hourlyRateInr: 250.0,
    fixedRateEstimateInr: 1200.0,
    reputationScore: 4.75,
    totalCompletedJobs: 19,
    locality: 'Worli',
    lat: 19.0144,
    lng: 72.818,
  },
  {
    email: 'priya-cleaner@sahayak.demo.internal',
    phone: '+919999000007',
    fullName: '[DEMO] Priya Kamble',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    primaryCategory: 'cleaning',
    skills: ['Full Home Deep Clean', 'Floor Scrubbing', 'Kitchen Chimney Degreasing', 'Window Glass Cleaning'],
    bio: '[DEMO] 7 years in residential deep hygiene across Juhu and Bandra. (Fictional profile for demonstration only).',
    yearsExperience: 7,
    serviceRadiusKm: 12.0,
    hourlyRateInr: 280.0,
    fixedRateEstimateInr: 1500.0,
    reputationScore: 4.9,
    totalCompletedJobs: 48,
    locality: 'Juhu',
    lat: 19.1075,
    lng: 72.8263,
  },

  // Carpentry (1)
  {
    email: 'jagdish-carpenter@sahayak.demo.internal',
    phone: '+919999000008',
    fullName: '[DEMO] Jagdish Mistry',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    primaryCategory: 'carpentry',
    skills: ['Furniture Assembly', 'Door Hinge Repair', 'Custom Shelving', 'Lock Replacement'],
    bio: '[DEMO] Skilled woodworker covering Malad, Kandivali, and Goregaon. (Fictional profile for demonstration only).',
    yearsExperience: 12,
    serviceRadiusKm: 14.0,
    hourlyRateInr: 450.0,
    fixedRateEstimateInr: 600.0,
    reputationScore: 4.9,
    totalCompletedJobs: 73,
    locality: 'Malad West',
    lat: 19.186,
    lng: 72.8485,
  },

  // Painting (1)
  {
    email: 'manoj-painter@sahayak.demo.internal',
    phone: '+919999000009',
    fullName: '[DEMO] Manoj Varma',
    avatarUrl: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150',
    primaryCategory: 'painting',
    skills: ['Wall Damp Proofing', 'Interior Painting', 'Stencils & Textures', 'Single Room Touch-up'],
    bio: '[DEMO] Painting contractor serving Goregaon and Jogeshwari. Expert in monsoon seepage barrier treatments. (Fictional profile for demonstration only).',
    yearsExperience: 8,
    serviceRadiusKm: 12.0,
    hourlyRateInr: 350.0,
    fixedRateEstimateInr: 2000.0,
    reputationScore: 4.8,
    totalCompletedJobs: 39,
    locality: 'Goregaon East',
    lat: 19.1663,
    lng: 72.8596,
  },

  // Appliance Repair (1)
  {
    email: 'deepak-appliance@sahayak.demo.internal',
    phone: '+919999000010',
    fullName: '[DEMO] Deepak Nair',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    primaryCategory: 'appliance_repair',
    skills: ['Washing Machine Repair', 'Refrigerator Servicing', 'Microwave Repair', 'AC Gas Refill'],
    bio: '[DEMO] Certified technician in Borivali and Dahisar for major home appliances. (Fictional profile for demonstration only).',
    yearsExperience: 10,
    serviceRadiusKm: 15.0,
    hourlyRateInr: 400.0,
    fixedRateEstimateInr: 750.0,
    reputationScore: 4.9,
    totalCompletedJobs: 58,
    locality: 'Borivali West',
    lat: 19.2307,
    lng: 72.8567,
  },

  // Cooking (1)
  {
    email: 'kavita-cook@sahayak.demo.internal',
    phone: '+919999000011',
    fullName: '[DEMO] Kavita Deshmukh',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    primaryCategory: 'cooking',
    skills: ['North Indian', 'Maharashtrian Thali', 'Dietary Meal Prep', 'Gujarati Delicacies'],
    bio: '[DEMO] Home chef with 6 years experience across Ghatkopar, Vidyavihar, and Mulund. (Fictional profile for demonstration only).',
    yearsExperience: 6,
    serviceRadiusKm: 10.0,
    hourlyRateInr: 300.0,
    fixedRateEstimateInr: 600.0,
    reputationScore: 4.85,
    totalCompletedJobs: 31,
    locality: 'Ghatkopar East',
    lat: 19.086,
    lng: 72.909,
  },

  // House Help / Maid (1) - primaryCategory is 'cleaning' matching DB constraint
  {
    email: 'lata-maid@sahayak.demo.internal',
    phone: '+919999000012',
    fullName: '[DEMO] Lata Gaikwad',
    avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150',
    primaryCategory: 'cleaning',
    skills: ['House Help', 'Daily Housekeeping', 'Floor Mopping', 'Dishwashing', 'Dusting & Organizing', 'Clothes Laundering'],
    bio: '[DEMO] Trustworthy domestic helper and general house maintenance specialist covering Chembur and Sion. (Fictional profile for demonstration only).',
    yearsExperience: 5,
    serviceRadiusKm: 8.0,
    hourlyRateInr: 250.0,
    fixedRateEstimateInr: 500.0,
    reputationScore: 4.7,
    totalCompletedJobs: 25,
    locality: 'Chembur',
    lat: 19.0522,
    lng: 72.8994,
  },
];

// Price benchmarks across all 8 trade categories (Mumbai & Delhi NCR)
const PRICE_BENCHMARKS = [
  // Mumbai
  { id: 'b0000000-0000-0000-0000-000000000001', category: 'plumbing', city: 'Mumbai', micro_market_area: 'Bandra & Western Suburbs', min_price_inr: 250, median_price_inr: 450, max_price_inr: 750, sample_size: 48 },
  { id: 'b0000000-0000-0000-0000-000000000002', category: 'plumbing', city: 'Mumbai', micro_market_area: 'South Mumbai (Dadar / Worli)', min_price_inr: 300, median_price_inr: 500, max_price_inr: 900, sample_size: 36 },
  { id: 'b0000000-0000-0000-0000-000000000003', category: 'plumbing', city: 'Mumbai', micro_market_area: 'Greater Mumbai (All Areas)', min_price_inr: 250, median_price_inr: 450, max_price_inr: 800, sample_size: 90 },
  { id: 'b0000000-0000-0000-0000-000000000004', category: 'electrical', city: 'Mumbai', micro_market_area: 'Bandra & Western Suburbs', min_price_inr: 200, median_price_inr: 400, max_price_inr: 700, sample_size: 52 },
  { id: 'b0000000-0000-0000-0000-000000000005', category: 'electrical', city: 'Mumbai', micro_market_area: 'Powai & Central Suburbs', min_price_inr: 250, median_price_inr: 450, max_price_inr: 800, sample_size: 41 },
  { id: 'b0000000-0000-0000-0000-000000000006', category: 'electrical', city: 'Mumbai', micro_market_area: 'Greater Mumbai (All Areas)', min_price_inr: 200, median_price_inr: 420, max_price_inr: 750, sample_size: 95 },
  { id: 'b0000000-0000-0000-0000-000000000007', category: 'cleaning', city: 'Mumbai', micro_market_area: 'Bandra & South Mumbai', min_price_inr: 800, median_price_inr: 1500, max_price_inr: 2800, sample_size: 60 },
  { id: 'b0000000-0000-0000-0000-000000000008', category: 'cleaning', city: 'Mumbai', micro_market_area: 'Andheri & Suburbs', min_price_inr: 700, median_price_inr: 1200, max_price_inr: 2400, sample_size: 45 },
  { id: 'b0000000-0000-0000-0000-000000000009', category: 'cleaning', city: 'Mumbai', micro_market_area: 'Greater Mumbai (All Areas)', min_price_inr: 750, median_price_inr: 1350, max_price_inr: 2600, sample_size: 105 },
  { id: 'b0000000-0000-0000-0000-000000000010', category: 'carpentry', city: 'Mumbai', micro_market_area: 'Western Suburbs', min_price_inr: 300, median_price_inr: 550, max_price_inr: 1000, sample_size: 30 },
  { id: 'b0000000-0000-0000-0000-000000000011', category: 'carpentry', city: 'Mumbai', micro_market_area: 'Greater Mumbai (All Areas)', min_price_inr: 300, median_price_inr: 550, max_price_inr: 950, sample_size: 65 },
  { id: 'b0000000-0000-0000-0000-000000000012', category: 'painting', city: 'Mumbai', micro_market_area: 'Greater Mumbai', min_price_inr: 1200, median_price_inr: 2500, max_price_inr: 5500, sample_size: 24 },
  { id: 'b0000000-0000-0000-0000-000000000013', category: 'appliance_repair', city: 'Mumbai', micro_market_area: 'Western & Central Suburbs', min_price_inr: 350, median_price_inr: 650, max_price_inr: 1400, sample_size: 40 },
  { id: 'b0000000-0000-0000-0000-000000000014', category: 'appliance_repair', city: 'Mumbai', micro_market_area: 'Greater Mumbai (All Areas)', min_price_inr: 350, median_price_inr: 650, max_price_inr: 1300, sample_size: 80 },
  { id: 'b0000000-0000-0000-0000-000000000015', category: 'cooking', city: 'Mumbai', micro_market_area: 'Greater Mumbai', min_price_inr: 350, median_price_inr: 600, max_price_inr: 1200, sample_size: 35 },
  { id: 'b0000000-0000-0000-0000-000000000016', category: 'cleaning', city: 'Mumbai', micro_market_area: 'Greater Mumbai (House Help & Domestic)', min_price_inr: 250, median_price_inr: 450, max_price_inr: 850, sample_size: 55 },

  // Delhi NCR
  { id: 'b0000000-0000-0000-0000-000000000017', category: 'plumbing', city: 'Delhi NCR', micro_market_area: 'South Delhi (Hauz Khas / Saket)', min_price_inr: 250, median_price_inr: 400, max_price_inr: 700, sample_size: 50 },
  { id: 'b0000000-0000-0000-0000-000000000018', category: 'electrical', city: 'Delhi NCR', micro_market_area: 'South Delhi & Noida', min_price_inr: 200, median_price_inr: 380, max_price_inr: 650, sample_size: 44 },
  { id: 'b0000000-0000-0000-0000-000000000019', category: 'cleaning', city: 'Delhi NCR', micro_market_area: 'South Delhi & Gurgaon', min_price_inr: 800, median_price_inr: 1400, max_price_inr: 2600, sample_size: 58 },
];

const STATIC_SAMPLE_JOB = {
  status: 'posted',
  category: 'plumbing',
  pincode: '400050',
  estimated_min_price_inr: 400.0,
  estimated_max_price_inr: 600.0,
  accepted_bid_id: null,
  accepted_price_inr: null,
};

const STATIC_SAMPLE_BID = {
  status: 'submitted',
  offered_amount_inr: 450.0,
  proposed_amount: 450.0,
  labor_cost_inr: 350.0,
  materials_estimate_inr: 100.0,
  visitation_fee_inr: 0.0,
  note: 'Can visit within 45 minutes with replacement rubber washers and heavy-duty sealant tape.',
};

// Check for --dry-run or --validate-only flag
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--validate-only') || process.argv.includes('-d');

// Build payload object for preflight validation
const seedPayloadToValidate = {
  demoCustomer: DEMO_CUSTOMER,
  demoWorkers: DEMO_WORKERS.map((w) => ({
    ...w,
    governmentIdVerified: false,
    backgroundCheckVerified: false,
  })),
  priceBenchmarks: PRICE_BENCHMARKS,
  sampleJob: STATIC_SAMPLE_JOB,
  sampleBid: STATIC_SAMPLE_BID,
  sampleReview: null, // Lifecycle requirement: reviews are only permitted on COMPLETED jobs
};

// Execute preflight validation
const preflightResult = validateSeedPayload(seedPayloadToValidate);

if (isDryRun) {
  console.log('🔍 Sahayak Demo Seed Preflight Validation (Dry-Run Mode)');
  console.log('----------------------------------------------------');
  if (preflightResult.valid) {
    console.log('✅ Preflight Validation PASSED:');
    console.log(`   - Customer: 1 valid identity (${DEMO_CUSTOMER.email})`);
    console.log(`   - Workers: ${DEMO_WORKERS.length} valid worker profiles across permitted categories`);
    console.log(`   - Pricing Benchmarks: ${PRICE_BENCHMARKS.length} valid benchmarks satisfying (category, locality) unique key`);
    console.log('   - Sample Job: POSTED status, valid pincode, no premature accepted bid');
    console.log('   - Sample Bid: PENDING status, required proposed_amount & offered_amount_inr, singular note column');
    console.log('   - Lifecycle Integrity: No invalid customer review on open POSTED job');
    process.exit(0);
  } else {
    console.error('❌ Preflight Validation FAILED with errors:');
    preflightResult.errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }
}

// 2. Read environment variables from .env.local if present
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

// 3. Strict prerequisite check - stop immediately if credentials missing
if (!supabaseUrl || !serviceRoleKey) {
  console.error(`
❌ PREREQUISITE ERROR: Missing Supabase Admin Credentials.

To safely provision demo worker accounts without raw SQL user fabrication,
this script requires:
  - NEXT_PUBLIC_SUPABASE_URL (e.g. https://your-project.supabase.co)
  - SUPABASE_SERVICE_ROLE_KEY (Found in Supabase Dashboard -> Project Settings -> API -> service_role secret)

Please ensure both variables are defined in your .env.local file:
  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

Then re-run:
  node scripts/seed-demo.mjs
`);
  process.exit(1);
}

// Ensure payload passed preflight before connecting
if (!preflightResult.valid) {
  console.error('❌ Preflight Validation FAILED: Cannot proceed with live writes.');
  preflightResult.errors.forEach((err) => console.error(`   - ${err}`));
  process.exit(1);
}

// 4. Initialize privileged Supabase Admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let cachedAuthUsers = null;

async function getOrCreateAuthUser(account) {
  if (!cachedAuthUsers) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      throw new Error(`Failed to list users from Supabase Auth Admin API: ${listError.message}`);
    }
    cachedAuthUsers = listData.users || [];
  }

  const existing = cachedAuthUsers.find(
    (u) => u.email?.toLowerCase() === account.email.toLowerCase()
  );

  if (existing) {
    return existing.id;
  }

  // Create user through official Supabase Auth Admin API
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email: account.email,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      role: account.role,
      is_demo_seed: true,
    },
  });

  if (createError) {
    if (createError.message?.toLowerCase().includes('already') || createError.status === 422) {
      const { data: refreshed } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = refreshed?.users?.find(
        (u) => u.email?.toLowerCase() === account.email.toLowerCase()
      );
      if (found) return found.id;
    }
    throw new Error(`Failed to create demo auth user [${account.email}]: ${createError.message}`);
  }

  cachedAuthUsers.push(createData.user);
  return createData.user.id;
}

async function runSeed() {
  console.log('🚀 Step 1/5: Provisioning Demo Auth Accounts via Supabase Auth Admin API...');

  // 1. Customer Account
  const customerAuthId = await getOrCreateAuthUser(DEMO_CUSTOMER);
  console.log(`  ✓ Customer Account: ${DEMO_CUSTOMER.fullName} (${DEMO_CUSTOMER.email})`);

  // Customer Profile
  const { error: custProfErr } = await supabase.from('profiles').upsert(
    {
      id: customerAuthId,
      phone: DEMO_CUSTOMER.phone,
      email: DEMO_CUSTOMER.email,
      full_name: DEMO_CUSTOMER.fullName,
      avatar_url: DEMO_CUSTOMER.avatarUrl,
      role: 'customer',
      verification_status: 'unverified',
      primary_city: 'Mumbai',
    },
    { onConflict: 'id' }
  );
  if (custProfErr) throw new Error(`Customer profile upsert failed: ${custProfErr.message}`);

  // 2. 12 Worker Accounts
  console.log('🚀 Step 2/5: Provisioning 12 Demo Worker Profiles (Mumbai Cluster)...');

  for (const worker of DEMO_WORKERS) {
    const workerUserId = await getOrCreateAuthUser({
      email: worker.email,
      fullName: worker.fullName,
      role: 'worker',
    });

    // Upsert public.profiles
    const { error: profErr } = await supabase.from('profiles').upsert(
      {
        id: workerUserId,
        phone: worker.phone,
        email: worker.email,
        full_name: worker.fullName,
        avatar_url: worker.avatarUrl,
        role: 'worker',
        // Fictional workers are explicitly unverified
        verification_status: 'unverified',
        primary_city: 'Mumbai',
      },
      { onConflict: 'id' }
    );
    if (profErr) throw new Error(`Profile upsert failed for ${worker.fullName}: ${profErr.message}`);

    // Upsert public.worker_profiles
    // PostGIS geography point format: POINT(longitude latitude)
    const pointWkt = `POINT(${worker.lng} ${worker.lat})`;

    const { error: wpErr } = await supabase.from('worker_profiles').upsert(
      {
        user_id: workerUserId,
        primary_category: worker.primaryCategory,
        skills: worker.skills,
        bio: worker.bio,
        years_experience: worker.yearsExperience,
        service_radius_km: worker.serviceRadiusKm,
        hourly_rate_inr: worker.hourlyRateInr,
        fixed_rate_estimate_inr: worker.fixedRateEstimateInr,
        is_available: true,
        is_publicly_visible: true,
        // Crucial: No false claims of verification
        government_id_verified: false,
        background_check_verified: false,
        reputation_score: worker.reputationScore,
        total_completed_jobs: worker.totalCompletedJobs,
        service_location: pointWkt,
      },
      { onConflict: 'user_id' }
    );

    if (wpErr) throw new Error(`Worker profile upsert failed for ${worker.fullName}: ${wpErr.message}`);
    console.log(`  ✓ [${worker.primaryCategory.toUpperCase()}] ${worker.fullName} in ${worker.locality}`);
  }

  // 3. Price Benchmarks
  console.log('🚀 Step 3/5: Seeding Micro-Market Price Benchmarks across 8 Categories...');
  for (const bm of PRICE_BENCHMARKS) {
    let existingId = null;

    const { data: byId } = await supabase
      .from('price_benchmarks')
      .select('id')
      .eq('id', bm.id)
      .maybeSingle();

    if (byId?.id) {
      existingId = byId.id;
    } else {
      const { data: byLocality, error: locErr } = await supabase
        .from('price_benchmarks')
        .select('id')
        .eq('category', bm.category)
        .eq('locality', bm.micro_market_area)
        .maybeSingle();

      if (!locErr && byLocality?.id) {
        existingId = byLocality.id;
      } else {
        const { data: byArea } = await supabase
          .from('price_benchmarks')
          .select('id')
          .eq('category', bm.category)
          .eq('micro_market_area', bm.micro_market_area)
          .maybeSingle();

        if (byArea?.id) {
          existingId = byArea.id;
        }
      }
    }

    const basePayload = {
      category: bm.category,
      city: bm.city,
      locality: bm.micro_market_area,
      micro_market_area: bm.micro_market_area,
      min_price: bm.min_price_inr,
      median_price: bm.median_price_inr,
      max_price: bm.max_price_inr,
      min_price_inr: bm.min_price_inr,
      median_price_inr: bm.median_price_inr,
      max_price_inr: bm.max_price_inr,
      sample_size: bm.sample_size,
      currency: 'INR',
      is_demo_estimate: true,
      last_calculated_at: new Date().toISOString(),
    };

    if (existingId) {
      const updatePayload = { ...basePayload };
      while (true) {
        const { error: updateErr } = await supabase
          .from('price_benchmarks')
          .update(updatePayload)
          .eq('id', existingId);
        if (!updateErr) break;
        const match = updateErr.message?.match(/Could not find the '([^']+)' column/);
        if (match && updatePayload[match[1]] !== undefined) {
          delete updatePayload[match[1]];
          continue;
        }
        throw new Error(`Benchmark update failed for [${bm.category} / ${bm.micro_market_area}]: ${updateErr.message}`);
      }
    } else {
      const insertPayload = { id: bm.id, ...basePayload };
      while (true) {
        // Use exact valid unique constraint target uq_price_benchmark_category_locality (category, locality)
        const { error: insertErr } = await supabase
          .from('price_benchmarks')
          .upsert(insertPayload, { onConflict: 'category,locality' });
        if (!insertErr) break;

        const match = insertErr.message?.match(/Could not find the '([^']+)' column/);
        if (match && insertPayload[match[1]] !== undefined) {
          delete insertPayload[match[1]];
          continue;
        }

        // If onConflict specification is rejected by PostgREST/Postgres, fallback to plain insert or unique_category_market
        if (insertErr.message?.includes('ON CONFLICT specification') || insertErr.code === '42P10') {
          const { error: fallbackErr } = await supabase
            .from('price_benchmarks')
            .upsert(insertPayload, { onConflict: 'category,city,micro_market_area' });
          if (!fallbackErr) break;

          const { error: plainErr } = await supabase
            .from('price_benchmarks')
            .insert(insertPayload);
          if (!plainErr) break;
          throw new Error(`Benchmark insert failed for [${bm.category} / ${bm.micro_market_area}]: ${plainErr.message}`);
        }

        throw new Error(`Benchmark insert failed for [${bm.category} / ${bm.micro_market_area}]: ${insertErr.message}`);
      }
    }
  }
  console.log(`  ✓ Inserted/Updated ${PRICE_BENCHMARKS.length} regional benchmark records.`);

  // 4. Sample Job & Pending Worker Bid (for Plumber Ramesh Kumar)
  console.log('🚀 Step 4/5: Seeding Sample Job & Pending Worker Bid...');

  // Resolve customer profile ID directly from persisted public.profiles
  const { data: customerProfile, error: custErr } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', DEMO_CUSTOMER.email)
    .maybeSingle();

  if (custErr || !customerProfile) {
    throw new Error(
      `Step 4 Resolution Error: Could not resolve customer profile from public.profiles for ${DEMO_CUSTOMER.email}: ${custErr?.message || 'Profile row not found'}`
    );
  }
  const resolvedCustomerId = customerProfile.id;

  // Resolve worker profile ID directly from persisted public.profiles
  const targetWorkerEmail = 'ramesh-plumber@sahayak.demo.internal';
  const { data: plumberProfile, error: plumberErr } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', targetWorkerEmail)
    .maybeSingle();

  if (plumberErr || !plumberProfile) {
    throw new Error(
      `Step 4 Resolution Error: Could not resolve worker profile from public.profiles for ${targetWorkerEmail}: ${plumberErr?.message || 'Profile row not found'}`
    );
  }
  const resolvedWorkerProfileId = plumberProfile.id;

  // Verify worker_profiles row exists for resolvedWorkerProfileId and retrieve its table primary key (worker_profiles.id)
  const { data: wpRow, error: wpErr } = await supabase
    .from('worker_profiles')
    .select('id, user_id, primary_category')
    .eq('user_id', resolvedWorkerProfileId)
    .maybeSingle();

  if (wpErr || !wpRow) {
    throw new Error(
      `Step 4 Resolution Error: Missing worker_profiles entry for ${targetWorkerEmail} (user_id: ${resolvedWorkerProfileId}): ${wpErr?.message || 'No worker profile found'}`
    );
  }
  // bids_worker_id_fkey in the live database references worker_profiles(id)
  const workerProfileForeignKeyId = wpRow.id || resolvedWorkerProfileId;

  const sampleJobId = 'd0000000-0000-0000-0000-000000000101';
  const sampleBidId = 'd0000000-0000-0000-0000-000000000201';

  // Sample job is posted, seeking worker bids (no worker or bid accepted yet)
  const jobPayload = {
    id: sampleJobId,
    customer_id: resolvedCustomerId,
    selected_worker_id: null,
    accepted_bid_id: null,
    category: 'plumbing',
    title: '[DEMO] Kitchen Sink Drain & Mixer Tap Leakage Repair',
    description: 'Kitchen basin pipe leaking into under-sink cabinet. Looking for prompt diagnosis and replacement of damaged fittings or washers.',
    urgency: 'standard',
    status: 'posted',
    location_point: 'POINT(72.8295 19.0596)',
    service_location: 'POINT(72.8295 19.0596)',
    address_line: 'Flat 402, Sea Green Apartments, Perry Cross Road, Bandra West',
    landmark: 'Near Candies Cafe',
    city: 'Mumbai',
    pincode: '400050',
    estimated_min_price_inr: 400.0,
    estimated_max_price_inr: 600.0,
    accepted_price_inr: null,
  };

  const { error: jobErr } = await supabase.from('jobs').upsert(jobPayload, { onConflict: 'id' });
  if (jobErr) {
    throw new Error(`Sample job upsert failed for job [${sampleJobId}]: ${jobErr.message}`);
  }

  // Upsert sample bid using verified worker profile ID
  const { data: existingBid } = await supabase
    .from('bids')
    .select('id')
    .eq('job_id', sampleJobId)
    .eq('worker_id', workerProfileForeignKeyId)
    .maybeSingle();

  const bidPayload = {
    id: existingBid?.id || sampleBidId,
    job_id: sampleJobId,
    worker_id: workerProfileForeignKeyId,
    offered_amount_inr: 450.0,
    proposed_amount: 450.0,
    labor_cost_inr: 350.0,
    materials_estimate_inr: 100.0,
    visitation_fee_inr: 0.0,
    status: 'submitted',
    note: 'Can visit within 45 minutes with replacement rubber washers and heavy-duty sealant tape.',
  };

  let { error: bidErr } = await supabase.from('bids').upsert(bidPayload, { onConflict: 'id' });
  if (
    bidErr &&
    (bidErr.message?.includes("'note' column") ||
      bidErr.message?.includes('column "note"') ||
      bidErr.message?.includes("Could not find the 'note' column"))
  ) {
    // If 'note' column is missing from the PostgREST schema cache, retry without this optional column
    delete bidPayload.note;
    const retry = await supabase.from('bids').upsert(bidPayload, { onConflict: 'id' });
    bidErr = retry.error;
  }
  if (bidErr) {
    throw new Error(`Sample bid upsert failed for bid [${sampleBidId}]: ${bidErr.message}`);
  }

  // Lifecycle integrity: remove any orphaned reviews for this open POSTED job from prior runs
  const { error: revCleanupErr } = await supabase
    .from('reviews')
    .delete()
    .eq('job_id', sampleJobId);

  if (revCleanupErr) {
    console.warn(`  ⚠️ Notice: Could not remove old sample reviews: ${revCleanupErr.message}`);
  }

  console.log('  ✓ Verified customer profile ID and worker profile ID from persisted database rows.');
  console.log('  ✓ Created sample job in posted status with active submitted bid from Ramesh Kumar.');
  console.log('  ✓ Preserved lifecycle integrity: no impossible review on open posted job.');

  // 5. Final Confirmation
  console.log('\n🎉 SUCCESS: Sahayak Demo Dataset has been fully seeded!');
  console.log('   - 12 Fictional Mumbai Workers (Plumbing: 3, Electrical: 2, Cleaning & House Help: 3, Carpentry: 1, Painting: 1, Appliance: 1, Cook: 1)');
  console.log('   - 19 Micro-Market Price Benchmarks across Mumbai & Delhi NCR');
  console.log('   - 1 Open Sample Job (posted) with Active Worker Bid (submitted) by [DEMO] Ramesh Kumar');
  console.log('   - All verification flags set to false (no false verification claims)');
}

runSeed().catch((err) => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
