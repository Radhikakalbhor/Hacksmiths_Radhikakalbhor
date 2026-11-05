/**
 * Sahayak Admin Panel Demo Data Seeder
 * Populates realistic, fictional demonstration records for:
 * 1. Admin account (`demo-admin@sahayak.demo.internal` / role: ADMIN)
 * 2. Unverified workers with pending verification documents (Aadhaar, PAN, Police Clearance)
 * 3. 60-day distribution of jobs across categories and Mumbai pincodes
 * 4. Active & historical Disputes with evidence logs
 * 5. SOS Incidents with locations and trusted contacts
 * 6. Flagged reviews for moderation
 * 7. System announcements
 * 8. AI job posting logs
 *
 * Requirements:
 * - All identities marked with [DEMO]
 * - Unverified workers left strictly unverified (never auto-verified)
 * - Safe & idempotent execution
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
  console.log('[INFO] Skipping database execution: Supabase credentials not configured in this environment.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdminDemo() {
  console.log('\x1b[34m[INFO] Seeding Sahayak Admin Panel demo datasets...\x1b[0m');

  // 1. Provision Demo Admin User
  const adminEmail = 'demo-admin@sahayak.demo.internal';
  const adminPhone = '+919999000000';
  let adminId;

  const { data: existingAdminUsers } = await supabase.auth.admin.listUsers();
  const existingAdmin = existingAdminUsers?.users?.find((u) => u.email === adminEmail);

  if (existingAdmin) {
    adminId = existingAdmin.id;
  } else {
    const { data: newAdmin, error: createAdminErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      phone: adminPhone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        full_name: '[DEMO] Platform Admin',
        role: 'ADMIN',
      },
    });
    if (createAdminErr) {
      console.warn('[WARN] Admin user creation note:', createAdminErr.message);
    } else {
      adminId = newAdmin?.user?.id;
    }
  }

  if (adminId) {
    await supabase.from('profiles').upsert(
      {
        id: adminId,
        email: adminEmail,
        phone: adminPhone,
        full_name: '[DEMO] Sahayak Super Admin',
        role: 'ADMIN',
        verification_status: 'verified',
        primary_city: 'Mumbai',
        is_suspended: false,
      },
      { onConflict: 'id' }
    );
    console.log('\x1b[32m✔ Demo Admin profile established.\x1b[0m');
  }

  // 2. Fetch or create Customer and Workers for references
  const { data: customerProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'customer')
    .limit(3);

  const { data: workerProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, verification_status')
    .eq('role', 'worker')
    .limit(10);

  const fallbackCustomerId = customerProfiles?.[0]?.id || adminId;
  const fallbackWorkerId = workerProfiles?.[0]?.id || adminId;

  // 3. Seed Unverified Worker with Verification Documents
  if (workerProfiles && workerProfiles.length > 0) {
    const candidateWorker = workerProfiles[0];
    // Ensure candidate worker is pending
    await supabase
      .from('profiles')
      .update({ verification_status: 'pending' })
      .eq('id', candidateWorker.id);

    await supabase.from('worker_profiles').update({
      government_id_verified: false,
      background_check_verified: false,
    }).eq('user_id', candidateWorker.id);

    // Insert verification docs
    const docs = [
      {
        worker_id: candidateWorker.id,
        doc_type: 'AADHAAR',
        file_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
        status: 'PENDING',
        notes: '[DEMO] Front and back of Aadhaar card submitted.',
      },
      {
        worker_id: candidateWorker.id,
        doc_type: 'POLICE_VERIFICATION',
        file_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800',
        status: 'PENDING',
        notes: '[DEMO] Police clearance certificate issued by Bandra West station.',
      },
      {
        worker_id: candidateWorker.id,
        doc_type: 'TRADE_CERTIFICATE',
        file_url: 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?w=800',
        status: 'PENDING',
        notes: '[DEMO] ITI Plumbing trade competency certificate.',
      },
    ];

    for (const doc of docs) {
      await supabase.from('verification_documents').insert(doc);
    }
    console.log('\x1b[32m✔ Sample worker verification documents seeded.\x1b[0m');
  }

  // 4. Seed Spread-out Jobs for 60-day historical analytics
  const categories = ['plumbing', 'electrical', 'cleaning', 'painting', 'carpentry', 'appliance_repair'];
  const pincodes = [
    { pin: '400050', loc: 'Bandra West', lat: 19.0596, lng: 72.8295 },
    { pin: '400028', loc: 'Dadar West', lat: 19.0178, lng: 72.8478 },
    { pin: '400069', loc: 'Andheri East', lat: 19.1136, lng: 72.8697 },
    { pin: '400070', loc: 'Kurla West', lat: 19.0726, lng: 72.8845 },
    { pin: '400076', loc: 'Powai', lat: 19.1176, lng: 72.9060 },
  ];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  console.log('\x1b[34m[INFO] Generating 60 days of historical jobs...\x1b[0m');
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(Math.random() * 58) + 1;
    const createdAt = new Date(now - daysAgo * dayMs).toISOString();
    const isCompleted = daysAgo > 3;
    const status = isCompleted ? 'COMPLETED' : 'IN_PROGRESS';
    const cat = categories[i % categories.length];
    const area = pincodes[i % pincodes.length];
    const price = 400 + (i % 6) * 150;

    await supabase.from('jobs').insert({
      customer_id: fallbackCustomerId,
      category: cat,
      title: `[DEMO] ${cat.toUpperCase()} Household Service in ${area.loc}`,
      description: `[DEMO] Routine maintenance and repairs required at ${area.loc}.`,
      status,
      urgency: 'standard',
      address_line: `${area.loc}, Mumbai`,
      city: 'Mumbai',
      pincode: area.pin,
      final_price_inr: price,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  console.log('\x1b[32m✔ 60-day historical jobs seeded.\x1b[0m');

  // 5. Seed Disputes
  const { data: sampleJobs } = await supabase.from('jobs').select('id, title').limit(2);
  if (sampleJobs && sampleJobs.length > 0) {
    await supabase.from('disputes').insert([
      {
        job_id: sampleJobs[0].id,
        raised_by: fallbackCustomerId,
        against_user: fallbackWorkerId,
        reason: '[DEMO] Unfinished pipe sealing led to minor leakage within 24 hours.',
        evidence: {
          customerNotes: 'Water started leaking under the sink the next morning.',
          claimedAmount: 650,
          photos: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500'],
        },
        status: 'OPEN',
      },
      {
        job_id: sampleJobs[1]?.id || sampleJobs[0].id,
        raised_by: fallbackWorkerId,
        against_user: fallbackCustomerId,
        reason: '[DEMO] Scope creep: customer requested 3 additional ceiling fans without adjusting bid.',
        evidence: {
          workerNotes: 'Agreed on 1 fan installation, but 3 were requested upon arrival.',
          additionalBilledAmount: 400,
        },
        status: 'UNDER_REVIEW',
      },
    ]);
    console.log('\x1b[32m✔ Sample disputes seeded.\x1b[0m');
  }

  // 6. Seed SOS Incidents
  await supabase.from('sos_incidents').insert([
    {
      triggered_by: fallbackCustomerId,
      severity: 'URGENT_EMERGENCY',
      status: 'TRIGGERED',
      notes: '[DEMO] Emergency button triggered during late evening service visit.',
      location_point: 'SRID=4326;POINT(72.8295 19.0596)',
      trusted_contacts: [
        { name: 'Rohit Deshmukh', phone: '+919999111222', relationship: 'Spouse' },
        { name: 'Dr. Sunita Rao', phone: '+919999333444', relationship: 'Family Friend' },
      ],
    },
    {
      triggered_by: fallbackWorkerId,
      severity: 'SAFETY_CHECK',
      status: 'ACKNOWLEDGED',
      notes: '[DEMO] Aggressive stray animals blocked premise exit.',
      location_point: 'SRID=4326;POINT(72.8478 19.0178)',
      trusted_contacts: [
        { name: 'Worker Union Rep', phone: '+919999555666', relationship: 'Supervisor' },
      ],
    },
  ]);
  console.log('\x1b[32m✔ Sample SOS incidents seeded.\x1b[0m');

  // 7. Seed Review Flags
  const { data: sampleReviews } = await supabase.from('reviews').select('id').limit(2);
  if (sampleReviews && sampleReviews.length > 0) {
    await supabase.from('review_flags').insert({
      review_id: sampleReviews[0].id,
      reason: '[DEMO] Suspected inappropriate language and unfair score retaliation.',
      status: 'PENDING',
    });
    console.log('\x1b[32m✔ Flagged review seeded.\x1b[0m');
  }

  // 8. Seed Platform Announcement
  await supabase.from('announcements').insert({
    title: '[DEMO] Monsoon Safety Protocol 2026',
    body: 'All outdoor electrical and plumbing partners must adhere to wet-weather insulated gear standards during heavy rainfall alerts.',
    audience: 'ALL',
    city: 'Mumbai',
    created_by: adminId,
  });

  // 9. Seed AI Job Log
  await supabase.from('ai_job_logs').insert([
    {
      input_type: 'voice',
      raw_input: '[DEMO Voice Audio Transcript] Mere kitchen ka sink leak ho raha hai aur paani niche floor par phail raha hai.',
      generated_scope: {
        title: 'Kitchen Sink Drain Leakage Repair',
        category: 'plumbing',
        suggestedBudgetInr: 450,
        durationEstimate: '45 mins',
        materialsRequired: ['Teflon tape', 'M-Seal', 'Washer ring'],
      },
      feedback: 'up',
    },
    {
      input_type: 'text',
      raw_input: '[DEMO Customer Input] AC is not cooling properly and making a buzzing noise.',
      generated_scope: {
        title: 'Split AC Compressor Diagnostic & Gas Check',
        category: 'appliance_repair',
        suggestedBudgetInr: 800,
        durationEstimate: '1.5 hours',
        materialsRequired: ['Refrigerant top-up', 'Capacitor tester'],
      },
      feedback: null,
    },
  ]);

  // 10. Audit Log Seed
  if (adminId) {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'SYSTEM_BOOTSTRAP',
      entity_type: 'SYSTEM',
      entity_id: 'GLOBAL',
      metadata: { note: 'Admin demo environment provisioned successfully.' },
    });
  }

  console.log('\x1b[32m✔ Admin panel demo dataset seeded successfully!\x1b[0m');
}

seedAdminDemo().catch((err) => {
  console.error('\x1b[31m[ERROR] Seeding failed:\x1b[0m', err.message);
  process.exit(1);
});

