# Sahayak (सहायक)

> **Trusted help. Fair work. Stronger communities.**

Sahayak is an AI-powered hyperlocal services marketplace connecting homeowners with nearby, verified blue-collar professionals—including plumbers, electricians, deep cleaners, painters, maids, and cooks.

Built for our 24-hour hackathon, Sahayak eliminates predatory aggregator commissions and arbitrary pricing through **AI multimodal job posting**, **transparent local price benchmarks**, **competitive worker bidding**, **two-stage OTP handoffs**, and **worker reputation passports**.

---

## 🛠 Technology Stack

- **Framework:** Next.js (App Router with Turbopack)
- **Language:** TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS v4 & Lucide Icons
- **Database:** Supabase PostgreSQL with PostGIS Geospatial extensions
- **Authentication:** Supabase Auth (Phone OTP & Session tokens)
- **AI Engine:** Google Gemini API (Multimodal voice, vision & text parsing)
- **Deployment:** Vercel

---

## 📁 Modular Project Architecture

```
sahayak/
├── .env.example              # Environment variables template
├── next.config.ts            # Next.js & Turbopack configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # Strict TypeScript compiler options
├── public/                   # Static assets & icons
└── src/
    ├── app/                  # Next.js App Router
    │   ├── api/health/       # System health & config check route
    │   ├── error.tsx         # Client error boundary
    │   ├── not-found.tsx     # Custom 404 handler
    │   ├── globals.css       # Design tokens (Deep Teal, Warm Off-White, Green)
    │   ├── layout.tsx        # Shell layout with SEO metadata & fonts
    │   └── page.tsx          # Sahayak landing page
    ├── components/
    │   ├── landing/          # Modular landing page sections
    │   │   ├── HeroSection.tsx            # Hero with AI multimodal teaser
    │   │   ├── ServicesGrid.tsx           # 8 core trade categories
    │   │   ├── BenchmarkPreview.tsx       # Local price matrix vs aggregators
    │   │   ├── SafetyFlow.tsx             # Two-stage OTP & SOS emergency
    │   │   ├── WorkerReputationPreview.tsx # Worker passport & verified KYC
    │   │   └── CallToActionBanner.tsx     # Community join banner
    │   ├── layout/           # App navigation & footer
    │   │   ├── Navbar.tsx
    │   │   └── Footer.tsx
    │   └── ui/               # Reusable primitives (Button, Card, Badge)
    ├── lib/
    │   ├── config/           # App constants & runtime env validation
    │   │   ├── constants.ts
    │   │   └── env.ts
    │   ├── services/         # Server-side service contracts
    │   │   ├── jobs.service.ts
    │   │   ├── workers.service.ts
    │   │   ├── pricing.service.ts
    │   │   └── safety.service.ts
    │   ├── supabase/         # Typed Supabase database clients
    │   │   ├── client.ts     # Browser client (Anon key)
    │   │   ├── server.ts     # Server client (SSR Cookies)
    │   │   └── admin.ts      # Privileged server-only client (Service role)
    │   └── validations/      # Input validation & boundary schemas
    │       ├── auth.ts
    │       ├── jobs.ts
    │       └── workers.ts
    └── types/                # Domain models & database schema types
        ├── database.types.ts # Supabase PostgreSQL & PostGIS types
        ├── roles.ts          # Customer, Worker & Admin interfaces
        ├── jobs.ts           # Job lifecycle status transitions & specs
        ├── bids.ts           # Bids, counter-offers & price benchmarks
        ├── safety.ts         # OTP milestones & SOS incident contracts
        └── reputation.ts     # Reputation passport & skill badges
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18+ or Node.js 20+
- npm 9+

### 2. Environment Setup
Copy the template environment file:
```bash
cp .env.example .env.local
```

Fill in your project credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Security Note:** `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are strictly server-only. They are never exposed to browser bundles.

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view Sahayak.

### 5. Check API Diagnostics
Visit [http://localhost:3000/api/health](http://localhost:3000/api/health) to inspect platform health and configuration status.

### 6. Applying Database Migrations (Supabase)
To apply the database schema, PostGIS extensions, and RLS policies to your Supabase project:

**Option A — Supabase CLI (Recommended):**
```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase db push
```

**Option B — Supabase SQL Editor:**
In your Supabase Dashboard, open the **SQL Editor** and run the migration files in order:
1. `supabase/migrations/20261024000001_initial_schema.sql` (Tables, PostGIS extension, spatial indexes)
2. `supabase/migrations/20261024000002_row_level_security.sql` (RLS policies & privilege escalation guards)
3. `supabase/migrations/20261024000003_postgis_nearby_workers.sql` (Spatial discovery & OTP verification RPCs)
4. `supabase/migrations/20261024000004_atomic_marketplace_operations.sql` (Atomic bid acceptance & race condition guard)
5. `supabase/seed.sql` (Illustrative demo price benchmarks)

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Builds the optimized production application |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint over the entire codebase |
| `npm run test` | Runs the automated unit & business logic test suite via `tsx --test` |

---

## 🛡 Phased Implementation Roadmap

- [x] **Phase 1: Project Initialization & Design System**
  - Modular directory structure, strict TypeScript types, Supabase utilities, and responsive landing page.
- [x] **Phase 2: Database and Backend Foundation**
  - Supabase PostgreSQL schema with PostGIS spatial indexing, strict RLS zero-trust policies, salted cryptographic OTP verification, and server-side services.
- [x] **Phase 3: Core Marketplace APIs** (Current)
  - Next.js App Router route handlers for customer jobs, worker discovery, bidding, counter-offers, and atomic bid acceptance (`accept_job_bid` RPC).
- [ ] **Phase 4: AI Multimodal Job Posting**
  - Google Gemini API integration for audio voice-note transcription, image fault diagnosis, and auto-generated task scopes.
- [ ] **Phase 5: OTP Handshake & Trust Safety**
  - Start OTP and Completion OTP state machine verification, 1-tap SOS event broadcasts to trusted contacts.
- [ ] **Phase 6: Deployment & Final Polish**
  - Production deployment to Vercel and hackathon submission.
