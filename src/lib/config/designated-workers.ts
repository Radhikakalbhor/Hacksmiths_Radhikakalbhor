/**
 * Configuration for Designated Cross-Service Real Test Workers.
 * These 5 verified real worker partner accounts appear across EVERY service category
 * in Sahayak for demonstration purposes, while utilizing the genuine real-worker booking workflow.
 *
 * Identification is strictly based on verified Supabase User IDs.
 */

export interface DesignatedWorkerInfo {
  userId: string;
  email: string;
  name: string;
  originalTrade: string;
}

export const DESIGNATED_CROSS_SERVICE_WORKERS: readonly DesignatedWorkerInfo[] = [
  {
    userId: '0fd68ac1-4a91-400d-9287-46fd12cb9f6f',
    email: 'aagamnew21@gmail.com',
    name: 'Agam',
    originalTrade: 'plumbing',
  },
  {
    userId: 'e46994d2-bc15-411b-b82e-015f69e31960',
    email: 'dhawalsunaniya763@gmail.com',
    name: 'Dhawal',
    originalTrade: 'plumbing',
  },
  {
    userId: '9c0783dc-218d-4c51-b7fa-31f2dfc23aac',
    email: 'kalbhorradhika7@gmail.com',
    name: 'Radha',
    originalTrade: 'plumbing',
  },
  {
    userId: '9682e393-1467-47e4-8dec-51076e0bdd37',
    email: 'radhika.kalbhor24@sakec.ac.in',
    name: 'Radhika',
    originalTrade: 'plumbing',
  },
  {
    userId: '0df39f8c-8aa4-496a-9171-64ce48f18a12',
    email: 'warriors22ghosh@gmail.com',
    name: 'Sayantan',
    originalTrade: 'electrical',
  },
] as const;

/**
 * Set of normalized Supabase User IDs for the 5 designated cross-service workers.
 */
export const DESIGNATED_CROSS_SERVICE_USER_IDS = new Set<string>(
  DESIGNATED_CROSS_SERVICE_WORKERS.map((w) => w.userId.toLowerCase())
);

/**
 * Set of normalized email addresses for cross-service workers (secondary check).
 */
export const DESIGNATED_CROSS_SERVICE_EMAILS = new Set<string>(
  DESIGNATED_CROSS_SERVICE_WORKERS.map((w) => w.email.toLowerCase())
);

/**
 * Excluded account user IDs and emails:
 * warrior22ghosh@gmail.com (User ID: 714b0e10-ef5f-418b-b474-a1a07d725911)
 * Must NEVER be granted cross-service eligibility.
 */
export const EXCLUDED_CROSS_SERVICE_USER_IDS = new Set<string>([
  '714b0e10-ef5f-418b-b474-a1a07d725911'.toLowerCase(),
]);

export const EXCLUDED_CROSS_SERVICE_EMAILS = new Set<string>([
  'warrior22ghosh@gmail.com'.toLowerCase(),
]);

/**
 * Evaluates whether a worker ID is one of the 5 designated cross-service demonstration accounts.
 */
export function isDesignatedCrossServiceWorkerId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const normalized = userId.toLowerCase().trim();
  if (EXCLUDED_CROSS_SERVICE_USER_IDS.has(normalized)) return false;
  return DESIGNATED_CROSS_SERVICE_USER_IDS.has(normalized);
}

/**
 * Evaluates whether an email belongs to one of the 5 designated cross-service accounts.
 */
export function isDesignatedCrossServiceEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  if (EXCLUDED_CROSS_SERVICE_EMAILS.has(normalized)) return false;
  return DESIGNATED_CROSS_SERVICE_EMAILS.has(normalized);
}

/**
 * Evaluates whether a worker (by user ID or email) is a designated cross-service worker.
 */
export function isDesignatedCrossServiceWorker(
  userId?: string | null,
  email?: string | null
): boolean {
  if (userId && EXCLUDED_CROSS_SERVICE_USER_IDS.has(userId.toLowerCase().trim())) {
    return false;
  }
  if (email && EXCLUDED_CROSS_SERVICE_EMAILS.has(email.toLowerCase().trim())) {
    return false;
  }
  if (userId && isDesignatedCrossServiceWorkerId(userId)) {
    return true;
  }
  if (email && isDesignatedCrossServiceEmail(email)) {
    return true;
  }
  return false;
}

