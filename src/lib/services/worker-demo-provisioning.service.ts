/**
 * Worker Demo Data Provisioning Service
 *
 * Centralized, idempotent demo-data provisioning engine for the Sahayak Worker Portal.
 * Ensures that ANY worker who registers or logs in (new or existing) experiences a fully
 * active, populated worker portal across:
 * - Work Overview (Upcoming, Pending, Accepted/Active, Rejected/Cancelled jobs)
 * - Earnings & Wallet (Available balance, total earned, pending settlements)
 * - Open Marketplace (Jobs across all 8+ categories in Delhi NCR)
 * - Transactions (Credits, debits, commission, simulated withdrawals)
 * - Reputation & Reviews (Scores, star breakdown, authentic Indian customer feedback)
 * - Worker Notifications
 *
 * Safety & Invariants:
 * 1. Account-specific: IDs and data are deterministic per worker ID.
 * 2. Idempotent: Never duplicates records on reload or repeated login.
 * 3. Priority: Real database records always take precedence over demo data.
 * 4. Financial Safety: Demo balances are marked isDemo: true and cannot be withdrawn as real money.
 */

import {
  WorkerWallet,
  WalletTransaction,
  JobEarningsBreakdown,
  WorkerNotification,
  TransactionType,
  TransactionStatus,
  PlatformSettings,
} from '@/types/wallet';

export interface DemoJob {
  id: string;
  customer_id: string;
  selected_worker_id: string | null;
  accepted_bid_id: string | null;
  category: string;
  title: string;
  description: string;
  urgency: 'standard' | 'same_day' | 'urgent' | 'emergency';
  status: string;
  address_line: string;
  city: string;
  pincode: string;
  estimated_min_price_inr: number;
  estimated_max_price_inr: number;
  accepted_price_inr: number | null;
  scheduled_date: string;
  scheduled_time_slot: string;
  created_at: string;
  customerName: string;
  customerPhone: string;
  customerAvatarUrl?: string;
  agreedPriceInr: number;
  is_demo: boolean;
  customer_name?: string;
  customer_phone?: string;
  quoted_price?: number;
  location?: string;
  booking: {
    stage: 'scheduled' | 'requested' | 'in_progress' | 'on_the_way' | 'arrived' | 'completed' | 'cancelled';
    scheduledDate: string;
    scheduledTimeSlot: string;
    agreedPriceInr: number;
    cancellationReason?: string;
    isDemo: boolean;
  };
}

export interface DemoReputationData {
  averageRating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  completionRate: number;
  punctualityScore: number;
  qualityScore: number;
  pricingHonestyScore: number;
  punctualityRating: number;
  qualityRating: number;
  badgeLevel: string;
  badges: string[];
  reviews: Array<{
    id: string;
    customerName: string;
    rating: number;
    date: string;
    comment: string;
    category: string;
    jobTitle?: string;
    verified: boolean;
  }>;
}

export class WorkerDemoProvisioningService {
  /**
   * Helper to generate a deterministic UUID string based on workerId and a key
   */
  private static makeId(workerId: string, suffix: string): string {
    const cleanWorker = workerId.replace(/[^a-zA-Z0-9]/g, '');
    const prefixPart = cleanWorker.slice(0, 4).padEnd(4, '0');
    const suffixPart = cleanWorker.slice(-4).padStart(4, '0');
    const cleanSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).padEnd(12, '0');
    return `d0000000-${prefixPart}-${suffixPart}-${cleanSuffix.slice(0, 4)}-${cleanSuffix.slice(4, 12)}`;
  }

  /**
   * Formats dates relative to current date (e.g. +1 day, -2 days) in YYYY-MM-DD format
   */
  private static relativeDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  /**
   * Relative ISO timestamp
   */
  private static relativeTimestamp(offsetDays: number, offsetHours: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(d.getHours() + offsetHours);
    return d.toISOString();
  }

  /**
   * 1. Work Overview Jobs: Categorized into upcoming, pending, accepted, rejected, completed
   */
  static getDemoJobs(
    workerId: string,
    primaryCategory: string = 'plumbing'
  ): {
    upcoming: DemoJob[];
    pending: DemoJob[];
    accepted: DemoJob[];
    rejected: DemoJob[];
    completed: DemoJob[];
  } {
    const cat = primaryCategory.toLowerCase();

    // 1. Upcoming Scheduled Jobs
    const upcoming: DemoJob[] = [
      {
        id: this.makeId(workerId, 'upc-1'),
        customer_id: this.makeId(workerId, 'cust-1'),
        selected_worker_id: workerId,
        accepted_bid_id: this.makeId(workerId, 'bid-1'),
        category: cat,
        title:
          cat === 'electrical'
            ? 'Inverter Wiring & MCB Distribution Box Upgrade'
            : cat === 'cleaning'
            ? 'Complete 2BHK Deep Cleaning & Disinfection'
            : 'Concealed Pipe Leakage & Sanitary Valve Fitting',
        description:
          'Customer reported persistent water leakage behind bathroom wall tiles. Requires replacement of faulty concealed valve and joint sealing.',
        urgency: 'standard',
        status: 'ASSIGNED',
        address_line: 'Flat 402, Block C, Green View Apartments, Vasant Kunj',
        city: 'Delhi NCR',
        pincode: '110070',
        estimated_min_price_inr: 450,
        estimated_max_price_inr: 700,
        accepted_price_inr: 580,
        scheduled_date: this.relativeDate(1),
        scheduled_time_slot: '10:30 AM - 12:30 PM',
        created_at: this.relativeTimestamp(-1, -2),
        customerName: 'Aarav Sharma',
        customerPhone: '+91 98201 44812',
        agreedPriceInr: 580,
        is_demo: true,
        booking: {
          stage: 'scheduled',
          scheduledDate: this.relativeDate(1),
          scheduledTimeSlot: '10:30 AM - 12:30 PM',
          agreedPriceInr: 580,
          isDemo: true,
        },
      },
      {
        id: this.makeId(workerId, 'upc-2'),
        customer_id: this.makeId(workerId, 'cust-2'),
        selected_worker_id: workerId,
        accepted_bid_id: this.makeId(workerId, 'bid-2'),
        category: cat,
        title:
          cat === 'electrical'
            ? 'Ceiling Fan Regulator & 3-Socket Repair'
            : cat === 'cleaning'
            ? 'Kitchen Deep Degreasing & Chimney Filter Wash'
            : 'Water Purifier RO Inlet & Kitchen Mixer Tap Fitting',
        description:
          'New RO water purifier needs dedicated high-pressure wall point connection and hot-cold mixer tap alignment in modular kitchen.',
        urgency: 'same_day',
        status: 'ASSIGNED',
        address_line: 'B-14, Hauz Khas Enclave, Near Market',
        city: 'Delhi NCR',
        pincode: '110016',
        estimated_min_price_inr: 500,
        estimated_max_price_inr: 800,
        accepted_price_inr: 650,
        scheduled_date: this.relativeDate(2),
        scheduled_time_slot: '02:00 PM - 04:00 PM',
        created_at: this.relativeTimestamp(-1, -6),
        customerName: 'Sneha Kapoor',
        customerPhone: '+91 98112 39014',
        agreedPriceInr: 650,
        is_demo: true,
        booking: {
          stage: 'scheduled',
          scheduledDate: this.relativeDate(2),
          scheduledTimeSlot: '02:00 PM - 04:00 PM',
          agreedPriceInr: 650,
          isDemo: true,
        },
      },
    ];

    // 2. Pending Offers (Direct Customer Requests awaiting Worker Response)
    const pending: DemoJob[] = [
      {
        id: this.makeId(workerId, 'pnd-1'),
        customer_id: this.makeId(workerId, 'cust-3'),
        selected_worker_id: null,
        accepted_bid_id: null,
        category: cat === 'electrical' ? 'electrical' : 'electrical',
        title: 'Main Circuit Breaker Tripping & Neutral Line Diagnostic',
        description:
          'Whenever the AC and geyser are switched on simultaneously, the main 32A MCB trips instantly. Needs wire continuity check.',
        urgency: 'urgent',
        status: 'POSTED',
        address_line: 'Tower 3, Apt 1104, Saket Residency, Saket',
        city: 'Delhi NCR',
        pincode: '110017',
        estimated_min_price_inr: 600,
        estimated_max_price_inr: 950,
        accepted_price_inr: null,
        scheduled_date: this.relativeDate(0),
        scheduled_time_slot: '04:00 PM - 06:00 PM',
        created_at: this.relativeTimestamp(0, -3),
        customerName: 'Rajesh Verma',
        customerPhone: '+91 97180 55192',
        agreedPriceInr: 780,
        is_demo: true,
        booking: {
          stage: 'requested',
          scheduledDate: this.relativeDate(0),
          scheduledTimeSlot: '04:00 PM - 06:00 PM',
          agreedPriceInr: 780,
          isDemo: true,
        },
      },
      {
        id: this.makeId(workerId, 'pnd-2'),
        customer_id: this.makeId(workerId, 'cust-4'),
        selected_worker_id: null,
        accepted_bid_id: null,
        category: cat === 'cleaning' ? 'cleaning' : 'cleaning',
        title: 'Sofa Shampooing & Balcony Pressure Wash',
        description:
          '5-seater fabric L-shape sofa steam extraction cleaning and high-pressure dust wash for 2 balconies.',
        urgency: 'standard',
        status: 'POSTED',
        address_line: 'D-82, Defence Colony, Flyover Road',
        city: 'Delhi NCR',
        pincode: '110024',
        estimated_min_price_inr: 1100,
        estimated_max_price_inr: 1600,
        accepted_price_inr: null,
        scheduled_date: this.relativeDate(1),
        scheduled_time_slot: '11:00 AM - 01:00 PM',
        created_at: this.relativeTimestamp(0, -5),
        customerName: 'Priya Joshi',
        customerPhone: '+91 98101 23490',
        agreedPriceInr: 1350,
        is_demo: true,
        booking: {
          stage: 'requested',
          scheduledDate: this.relativeDate(1),
          scheduledTimeSlot: '11:00 AM - 01:00 PM',
          agreedPriceInr: 1350,
          isDemo: true,
        },
      },
    ];

    // 3. Accepted & Active Jobs (In Transit / In Progress)
    const accepted: DemoJob[] = [
      {
        id: this.makeId(workerId, 'act-1'),
        customer_id: this.makeId(workerId, 'cust-5'),
        selected_worker_id: workerId,
        accepted_bid_id: this.makeId(workerId, 'bid-act-1'),
        category: cat,
        title: 'Emergency Overhead Tank Overflow Sensor Failure',
        description:
          'Rooftop water tank sensor failed and water is continuously overflowing onto terrace. Quick emergency switch repair required.',
        urgency: 'emergency',
        status: 'IN_PROGRESS',
        address_line: 'E-45, Greater Kailash 1 (GK-1)',
        city: 'Delhi NCR',
        pincode: '110048',
        estimated_min_price_inr: 500,
        estimated_max_price_inr: 850,
        accepted_price_inr: 700,
        scheduled_date: this.relativeDate(0),
        scheduled_time_slot: 'Immediate Dispatch',
        created_at: this.relativeTimestamp(0, -1),
        customerName: 'Vikram Malhotra',
        customerPhone: '+91 99100 88210',
        agreedPriceInr: 700,
        is_demo: true,
        booking: {
          stage: 'in_progress',
          scheduledDate: this.relativeDate(0),
          scheduledTimeSlot: 'Immediate Dispatch',
          agreedPriceInr: 700,
          isDemo: true,
        },
      },
    ];

    // 4. Rejected / Cancelled Job History
    const rejected: DemoJob[] = [
      {
        id: this.makeId(workerId, 'rej-1'),
        customer_id: this.makeId(workerId, 'cust-6'),
        selected_worker_id: workerId,
        accepted_bid_id: null,
        category: 'carpentry',
        title: 'Bed Frame Slat Tightening & Wardrobe Hinge Realignment',
        description:
          'Master bedroom hydraulic bed squeaking loudly when moved, plus alignment of 4 wardrobe shutter hinges.',
        urgency: 'standard',
        status: 'CANCELLED',
        address_line: 'M-12, Lajpat Nagar II, Central Market',
        city: 'Delhi NCR',
        pincode: '110024',
        estimated_min_price_inr: 400,
        estimated_max_price_inr: 650,
        accepted_price_inr: 500,
        scheduled_date: this.relativeDate(-3),
        scheduled_time_slot: '03:00 PM - 05:00 PM',
        created_at: this.relativeTimestamp(-4, 0),
        customerName: 'Ananya Mehta',
        customerPhone: '+91 98711 02918',
        agreedPriceInr: 500,
        is_demo: true,
        booking: {
          stage: 'cancelled',
          scheduledDate: this.relativeDate(-3),
          scheduledTimeSlot: '03:00 PM - 05:00 PM',
          agreedPriceInr: 500,
          cancellationReason: 'Customer rescheduled appointment due to emergency outstation travel.',
          isDemo: true,
        },
      },
    ];

    // 5. Completed Jobs
    const completed: DemoJob[] = [
      {
        id: this.makeId(workerId, 'cmp-1'),
        customer_id: this.makeId(workerId, 'cust-7'),
        selected_worker_id: workerId,
        accepted_bid_id: this.makeId(workerId, 'bid-cmp-1'),
        category: cat,
        title: 'Under-sink Waste Coupling & Flexible Drain Pipe Replacement',
        description:
          'Kitchen sink drainage line clogged with grease buildup, causing backflow. Fully cleaned and replaced flexible drain pipe.',
        urgency: 'same_day',
        status: 'COMPLETED',
        address_line: 'C-21, Malviya Nagar, Near Main Market',
        city: 'Delhi NCR',
        pincode: '110017',
        estimated_min_price_inr: 450,
        estimated_max_price_inr: 750,
        accepted_price_inr: 600,
        scheduled_date: this.relativeDate(-2),
        scheduled_time_slot: '11:00 AM - 01:00 PM',
        created_at: this.relativeTimestamp(-3, 0),
        customerName: 'Rohan Patil',
        customerPhone: '+91 98201 19283',
        agreedPriceInr: 600,
        is_demo: true,
        booking: {
          stage: 'completed',
          scheduledDate: this.relativeDate(-2),
          scheduledTimeSlot: '11:00 AM - 01:00 PM',
          agreedPriceInr: 600,
          isDemo: true,
        },
      },
      {
        id: this.makeId(workerId, 'cmp-2'),
        customer_id: this.makeId(workerId, 'cust-8'),
        selected_worker_id: workerId,
        accepted_bid_id: this.makeId(workerId, 'bid-cmp-2'),
        category: cat,
        title: 'Geyser Hot Water Pipe Joint Teflon Taping & Pressure Test',
        description:
          'Electric geyser copper pipe joint had slow drop leakage. Replaced brass union washer, applied Teflon tape and pressure tested.',
        urgency: 'standard',
        status: 'COMPLETED',
        address_line: 'Tower B, Flat 701, Mayur Vihar Phase 1',
        city: 'Delhi NCR',
        pincode: '110091',
        estimated_min_price_inr: 600,
        estimated_max_price_inr: 1000,
        accepted_price_inr: 850,
        scheduled_date: this.relativeDate(-5),
        scheduled_time_slot: '02:00 PM - 04:00 PM',
        created_at: this.relativeTimestamp(-6, 0),
        customerName: 'Neha Sharma',
        customerPhone: '+91 98118 77621',
        agreedPriceInr: 850,
        is_demo: true,
        booking: {
          stage: 'completed',
          scheduledDate: this.relativeDate(-5),
          scheduledTimeSlot: '02:00 PM - 04:00 PM',
          agreedPriceInr: 850,
          isDemo: true,
        },
      },
    ];

    const enrich = (list: DemoJob[]) =>
      list.map((j) => ({
        ...j,
        customer_name: j.customerName,
        customer_phone: j.customerPhone,
        quoted_price: j.agreedPriceInr,
        location: `${j.address_line}, ${j.city}`,
      }));

    return {
      upcoming: enrich(upcoming),
      pending: enrich(pending),
      accepted: enrich(accepted),
      rejected: enrich(rejected),
      completed: enrich(completed),
    };
  }

  /**
   * 2. Earnings & Wallet Data
   */
  static getDemoWallet(workerId: string): WorkerWallet {
    return {
      id: `demo-wallet-${workerId.slice(0, 8)}`,
      workerId,
      availableBalanceInr: 2850.0,
      pendingBalanceInr: 600.0,
      totalEarnedInr: 4200.0,
      totalWithdrawnInr: 1000.0,
      totalDeductionsInr: 350.0,
      isDemo: true,
      isWithdrawable: false,
      createdAt: this.relativeTimestamp(-30),
      updatedAt: this.relativeTimestamp(0),
    };
  }

  /**
   * 3. Job Earnings Breakdown (Completed Payments & Settlements)
   */
  static getDemoJobEarningsBreakdown(workerId: string): JobEarningsBreakdown[] {
    return [
      {
        jobId: this.makeId(workerId, 'cmp-2'),
        jobTitle: 'Geyser Hot Water Pipe Joint Teflon Taping & Pressure Test',
        customerName: 'Neha Sharma',
        completedAt: this.relativeTimestamp(-5),
        grossAmountInr: 850.0,
        commissionRatePercent: 10.0,
        commissionAmountInr: 85.0,
        approvedDeductionsInr: 0.0,
        workerNetEarningInr: 765.0,
        paymentStatus: 'RELEASED_TO_WALLET',
        releasedAt: this.relativeTimestamp(-5, 2),
      },
      {
        jobId: this.makeId(workerId, 'cmp-1'),
        jobTitle: 'Under-sink Waste Coupling & Flexible Drain Pipe Replacement',
        customerName: 'Rohan Patil',
        completedAt: this.relativeTimestamp(-2),
        grossAmountInr: 600.0,
        commissionRatePercent: 10.0,
        commissionAmountInr: 60.0,
        approvedDeductionsInr: 0.0,
        workerNetEarningInr: 540.0,
        paymentStatus: 'RELEASED_TO_WALLET',
        releasedAt: this.relativeTimestamp(-2, 1),
      },
      {
        jobId: this.makeId(workerId, 'cmp-3'),
        jobTitle: 'Electrical Sub-Meter & Heavy-Duty 32A Power Plug Installation',
        customerName: 'Kunal Deshmukh',
        completedAt: this.relativeTimestamp(-9),
        grossAmountInr: 1200.0,
        commissionRatePercent: 10.0,
        commissionAmountInr: 120.0,
        approvedDeductionsInr: 0.0,
        workerNetEarningInr: 1080.0,
        paymentStatus: 'RELEASED_TO_WALLET',
        releasedAt: this.relativeTimestamp(-9, 3),
      },
      {
        jobId: this.makeId(workerId, 'cmp-4'),
        jobTitle: 'Emergency Water Leak Isolation & Valve Fitting',
        customerName: 'Vikram Malhotra',
        completedAt: this.relativeTimestamp(0, -1),
        grossAmountInr: 700.0,
        commissionRatePercent: 10.0,
        commissionAmountInr: 70.0,
        approvedDeductionsInr: 0.0,
        workerNetEarningInr: 630.0,
        paymentStatus: 'HELD_IN_ESCROW',
        releasedAt: null,
      },
    ];
  }

  /**
   * 4. Realistic Immutable Transaction Ledger
   */
  static getDemoTransactions(
    workerId: string,
    options?: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: TransactionStatus;
    }
  ): { transactions: WalletTransaction[]; total: number } {
    const walletId = `demo-wallet-${workerId.slice(0, 8)}`;

    const allTx: WalletTransaction[] = [
      {
        id: this.makeId(workerId, 'tx-1'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-1'),
        transactionType: 'JOB_PAYOUT',
        amountInr: 540.0,
        balanceAfterInr: 2850.0,
        status: 'COMPLETED',
        description: 'Settlement for Under-sink Waste Coupling (Job #SHK-4819)',
        referenceId: 'DEMO-TX-4819-CREDIT',
        isDemo: true,
        createdAt: this.relativeTimestamp(-2, 1),
      },
      {
        id: this.makeId(workerId, 'tx-2'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-1'),
        transactionType: 'COMMISSION_DEDUCTION',
        amountInr: 60.0,
        balanceAfterInr: 2310.0,
        status: 'COMPLETED',
        description: '10% Platform Commission deduction (Job #SHK-4819)',
        referenceId: 'DEMO-TX-4819-COMM',
        isDemo: true,
        createdAt: this.relativeTimestamp(-2, 1),
      },
      {
        id: this.makeId(workerId, 'tx-3'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-2'),
        transactionType: 'JOB_PAYOUT',
        amountInr: 765.0,
        balanceAfterInr: 2370.0,
        status: 'COMPLETED',
        description: 'Settlement for Geyser Hot Water Joint Repair (Job #SHK-3210)',
        referenceId: 'DEMO-TX-3210-CREDIT',
        isDemo: true,
        createdAt: this.relativeTimestamp(-5, 2),
      },
      {
        id: this.makeId(workerId, 'tx-4'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-2'),
        transactionType: 'COMMISSION_DEDUCTION',
        amountInr: 85.0,
        balanceAfterInr: 1605.0,
        status: 'COMPLETED',
        description: '10% Platform Commission deduction (Job #SHK-3210)',
        referenceId: 'DEMO-TX-3210-COMM',
        isDemo: true,
        createdAt: this.relativeTimestamp(-5, 2),
      },
      {
        id: this.makeId(workerId, 'tx-5'),
        walletId,
        workerId,
        jobId: null,
        transactionType: 'WITHDRAWAL',
        amountInr: 1000.0,
        balanceAfterInr: 1690.0,
        status: 'COMPLETED',
        description: 'Withdrawal to Verified UPI (UPI: partner@okhdfcbank)',
        referenceId: 'DEMO-WTH-9820-UPI',
        isDemo: true,
        createdAt: this.relativeTimestamp(-7, 4),
      },
      {
        id: this.makeId(workerId, 'tx-6'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-3'),
        transactionType: 'JOB_PAYOUT',
        amountInr: 1080.0,
        balanceAfterInr: 2690.0,
        status: 'COMPLETED',
        description: 'Settlement for Electrical Sub-Meter Installation (Job #SHK-2105)',
        referenceId: 'DEMO-TX-2105-CREDIT',
        isDemo: true,
        createdAt: this.relativeTimestamp(-9, 3),
      },
      {
        id: this.makeId(workerId, 'tx-7'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-3'),
        transactionType: 'COMMISSION_DEDUCTION',
        amountInr: 120.0,
        balanceAfterInr: 1610.0,
        status: 'COMPLETED',
        description: '10% Platform Commission deduction (Job #SHK-2105)',
        referenceId: 'DEMO-TX-2105-COMM',
        isDemo: true,
        createdAt: this.relativeTimestamp(-9, 3),
      },
      {
        id: this.makeId(workerId, 'tx-8'),
        walletId,
        workerId,
        jobId: this.makeId(workerId, 'cmp-5'),
        transactionType: 'JOB_PAYOUT',
        amountInr: 450.0,
        balanceAfterInr: 1730.0,
        status: 'COMPLETED',
        description: 'Settlement for Bathroom Flush Valve Replacement (Job #SHK-1980)',
        referenceId: 'DEMO-TX-1980-CREDIT',
        isDemo: true,
        createdAt: this.relativeTimestamp(-14, 2),
      },
    ];

    // Filter by type / status if requested
    let filtered = allTx;
    if (options?.type && options.type !== ('ALL' as unknown)) {
      filtered = filtered.filter((t) => t.transactionType === options.type);
    }
    if (options?.status && options.status !== ('ALL' as unknown)) {
      filtered = filtered.filter((t) => t.status === options.status);
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return { transactions: paginated, total: filtered.length };
  }

  /**
   * 5. Open Marketplace: Multi-Category Jobs across Delhi NCR
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getDemoMarketplaceJobs(): any[] {
    const marketplaceList = [
      {
        id: 'd0000000-0000-0000-mkt0-000000000001',
        category: 'plumbing',
        title: 'Leaking Concealed Shower Mixer & Wall Seepage Repair',
        description:
          'Bathroom shower mixer is leaking from inside the tiled wall. Homeowner seeks experienced plumber with moisture leak detector and replacement cartridge.',
        urgency: 'same_day',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Block C, Hauz Khas Enclave',
        pincode: '110016',
        estimated_min_price_inr: 450,
        estimated_max_price_inr: 750,
        scheduled_date: this.relativeDate(0),
        scheduled_time_slot: '04:00 PM - 06:00 PM',
        created_at: this.relativeTimestamp(0, -2),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000002',
        category: 'electrical',
        title: '3-Phase Inverter Setup & MCB Distribution Box Rewiring',
        description:
          'New 3.5kVA hybrid solar inverter requires dedicated line connection to 8 circuit distribution panel with neutral loop check.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Sector 62, Noida, Near Fortis Hospital',
        pincode: '201309',
        estimated_min_price_inr: 800,
        estimated_max_price_inr: 1300,
        scheduled_date: this.relativeDate(1),
        scheduled_time_slot: '11:00 AM - 01:00 PM',
        created_at: this.relativeTimestamp(0, -4),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000003',
        category: 'cleaning',
        title: 'Full 3BHK Apartment Post-Tenancy Deep Cleaning',
        description:
          'Complete end-of-tenancy scrubbing, bathroom scale removal, kitchen grease cleaning, and balcony pressure washing for vacant 3BHK flat.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'DLF Phase 5, Golf Course Road, Gurgaon',
        pincode: '122002',
        estimated_min_price_inr: 2200,
        estimated_max_price_inr: 3200,
        scheduled_date: this.relativeDate(2),
        scheduled_time_slot: '09:00 AM - 02:00 PM',
        created_at: this.relativeTimestamp(0, -6),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000004',
        category: 'painting',
        title: 'Living Room Accent Wall Texture & Ceiling Touch-Up',
        description:
          'Single 14x10 ft living room feature wall requires royal velvet metallic stencils and damp plaster touch-up before festival.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Ahinsa Khand 2, Indirapuram, Ghaziabad',
        pincode: '201014',
        estimated_min_price_inr: 1400,
        estimated_max_price_inr: 2100,
        scheduled_date: this.relativeDate(3),
        scheduled_time_slot: '10:00 AM - 03:00 PM',
        created_at: this.relativeTimestamp(-1, 0),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000005',
        category: 'carpentry',
        title: 'Modular Kitchen Soft-Close Hinge & Channel Replacement',
        description:
          '6 modular kitchen cabinet shutters are misaligned, plus 2 tandem drawer sliding channels need replacement and lubrication.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Pocket 1, Sector 11, Dwarka',
        pincode: '110075',
        estimated_min_price_inr: 550,
        estimated_max_price_inr: 900,
        scheduled_date: this.relativeDate(1),
        scheduled_time_slot: '03:00 PM - 05:00 PM',
        created_at: this.relativeTimestamp(-1, -3),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000006',
        category: 'appliance_repair',
        title: 'Front-Load Washing Machine Drum Vibration & Bearing Noise',
        description:
          '7kg Bosch front-load washer makes high-pitched whining noise during 1200 RPM spin cycle. Likely drum bearing or damper suspension issue.',
        urgency: 'same_day',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Poorvi Marg, Vasant Vihar',
        pincode: '110057',
        estimated_min_price_inr: 650,
        estimated_max_price_inr: 1100,
        scheduled_date: this.relativeDate(0),
        scheduled_time_slot: '05:00 PM - 07:00 PM',
        created_at: this.relativeTimestamp(0, -1),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000007',
        category: 'cooking',
        title: 'North Indian Home Cook for Family Dinner Party (8 Pax)',
        description:
          'Experienced cook needed for Saturday dinner: Dal Makhani, Paneer Butter Masala, Jeera Rice, and fresh Phulkas. Ingredients provided.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'Barakhamba Road, Connaught Place',
        pincode: '110001',
        estimated_min_price_inr: 900,
        estimated_max_price_inr: 1400,
        scheduled_date: this.relativeDate(2),
        scheduled_time_slot: '05:30 PM - 08:30 PM',
        created_at: this.relativeTimestamp(-1, -5),
        is_demo: true,
      },
      {
        id: 'd0000000-0000-0000-mkt0-000000000008',
        category: 'other_services',
        title: 'Wall Anchor Drilling, Heavy Mirror & Curtain Rod Installation',
        description:
          'Need precision masonry drill to mount 3 blackout curtain rods and 2 heavy framed mirrors onto concrete walls.',
        urgency: 'standard',
        status: 'POSTED',
        city: 'Delhi NCR',
        address_line: 'J-Block, Saket, Near PVR Anupam',
        pincode: '110017',
        estimated_min_price_inr: 400,
        estimated_max_price_inr: 650,
        scheduled_date: this.relativeDate(1),
        scheduled_time_slot: '11:00 AM - 01:00 PM',
        created_at: this.relativeTimestamp(0, -3),
        is_demo: true,
      },
    ];

    const customerNames = [
      'Pooja More',
      'Amitabh Saxena',
      'Sunita Agarwal',
      'Kavita Rao',
      'Rohan Verma',
      'Suresh Yadav',
      'Meera Iyer',
      'Vikram Malhotra',
    ];

    return marketplaceList.map((j, idx) => ({
      ...j,
      customer_id: `d0000000-0000-0000-cust-mkt${String(idx + 1).padStart(9, '0')}`,
      customer_name: customerNames[idx % customerNames.length],
      customerName: customerNames[idx % customerNames.length],
      min_price: j.estimated_min_price_inr,
      max_price: j.estimated_max_price_inr,
      location: `${j.address_line}, ${j.city}`,
    }));
  }

  /**
   * 6. Reputation & Verified Reviews
   */
  static getDemoReputation(workerId: string): DemoReputationData {
    return {
      averageRating: 4.88,
      totalReviews: 18,
      totalCompletedJobs: 24,
      completionRate: 98,
      punctualityScore: 4.95,
      qualityScore: 4.85,
      pricingHonestyScore: 4.90,
      punctualityRating: 4.95,
      qualityRating: 4.85,
      badgeLevel: 'Top Rated Professional',
      badges: [
        'ID Verified',
        'Top Rated Professional',
        'Transparent Pricing',
        'Zero Cancellation Guarantee',
      ],
      reviews: [
        {
          id: this.makeId(workerId, 'rev-1'),
          customerName: 'Ananya Deshmukh',
          rating: 5,
          date: this.relativeDate(-3),
          jobTitle: 'Concealed Valve Leak Repair',
          comment:
            'Arrived right on time with all required tools and replacement parts. Diagnosed the concealed valve leak quickly and completed the repair without damaging tiles. Super polite and professional!',
          category: 'Plumbing',
          verified: true,
        },
        {
          id: this.makeId(workerId, 'rev-2'),
          customerName: 'Rajesh Verma',
          rating: 5,
          date: this.relativeDate(-6),
          jobTitle: 'Electrical Tripping & MCB Diagnosis',
          comment:
            'Very skilled tradesman. Fixed an electrical tripping problem that two previous local technicians could not diagnose. Highly recommended for transparent rates!',
          category: 'Electrical',
          verified: true,
        },
        {
          id: this.makeId(workerId, 'rev-3'),
          customerName: 'Priya Joshi',
          rating: 5,
          date: this.relativeDate(-11),
          jobTitle: 'Deep Kitchen & Bathroom Cleaning',
          comment:
            'Exceptional attention to detail during the deep cleaning. Left the bathrooms and kitchen spotless. Fair pricing and respectful demeanor.',
          category: 'Deep Cleaning',
          verified: true,
        },
        {
          id: this.makeId(workerId, 'rev-4'),
          customerName: 'Vikram Malhotra',
          rating: 4,
          date: this.relativeDate(-18),
          jobTitle: 'Emergency Pipe Blockage Clearance',
          comment:
            'Quick turnaround for emergency pipe blockage. Cleaned up the workspace nicely after finishing. Good experience overall.',
          category: 'Plumbing',
          verified: true,
        },
      ],
    };
  }

  /**
   * 7. Notifications
   */
  static getDemoNotifications(workerId: string): WorkerNotification[] {
    return [
      {
        id: this.makeId(workerId, 'notif-1'),
        workerId,
        type: 'PAYMENT_CREDITED',
        title: 'Payment Credited',
        message: '₹765.00 has been credited to your Sahayak Wallet for Job #SHK-3210 (Geyser Repair).',
        jobId: this.makeId(workerId, 'cmp-2'),
        isRead: false,
        createdAt: this.relativeTimestamp(-5, 2),
      },
      {
        id: this.makeId(workerId, 'notif-2'),
        workerId,
        type: 'UPCOMING_REMINDER',
        title: 'Upcoming Service Tomorrow',
        message: 'Reminder: You have a scheduled appointment with Aarav Sharma tomorrow at 10:30 AM.',
        jobId: this.makeId(workerId, 'upc-1'),
        isRead: false,
        createdAt: this.relativeTimestamp(0, -2),
      },
      {
        id: this.makeId(workerId, 'notif-3'),
        workerId,
        type: 'OFFER_ACCEPTED',
        title: 'Offer Accepted by Customer',
        message: 'Customer Sneha Kapoor accepted your quote of ₹650 for Kitchen Tap & RO Fitting.',
        jobId: this.makeId(workerId, 'upc-2'),
        isRead: true,
        createdAt: this.relativeTimestamp(-1, -6),
      },
      {
        id: this.makeId(workerId, 'notif-4'),
        workerId,
        type: 'NEW_OFFER',
        title: 'New Service Request Nearby',
        message: 'New open job posted in Hauz Khas: "Leaking Concealed Shower Mixer". Submit your quote now.',
        jobId: 'd0000000-0000-0000-mkt0-000000000001',
        isRead: true,
        createdAt: this.relativeTimestamp(0, -1),
      },
    ];
  }

  /**
   * 8. Financial Guard: Demo Funds Cannot Be Withdrawn
   */
  static validateWithdrawal(
    wallet: WorkerWallet | null,
    amount: number
  ): { allowed: boolean; valid: boolean; error?: string } {
    if (!wallet) {
      return { allowed: false, valid: false, error: 'Wallet not found.' };
    }

    if (amount <= 0 || isNaN(amount)) {
      return { allowed: false, valid: false, error: 'Withdrawal amount must be greater than zero.' };
    }

    if (wallet.isDemo || wallet.id.startsWith('demo-') || wallet.isWithdrawable === false) {
      return {
        allowed: false,
        valid: false,
        error:
          'Demo wallet funds cannot be withdrawn as real money. Complete real customer service jobs to earn withdrawable balance.',
      };
    }

    if (amount > wallet.availableBalanceInr) {
      return { allowed: false, valid: false, error: 'Withdrawal amount cannot exceed your available balance.' };
    }

    return { allowed: true, valid: true };
  }
}
