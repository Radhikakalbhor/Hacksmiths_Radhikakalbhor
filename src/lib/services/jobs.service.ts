/**
 * Jobs Service
 * Server-side service orchestrating job creation, bidding, and state-machine transitions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, JobStatus, JobUrgency, Json } from '@/types/database.types';
import { canTransitionJob } from '@/types/jobs';
import { CreateJobInput, CreateBidInput } from '@/lib/validations/jobs';

export type JobRow = Database['public']['Tables']['jobs']['Row'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type BidRow = Database['public']['Tables']['bids']['Row'];
export type BidInsert = Database['public']['Tables']['bids']['Insert'];

export class JobsService {
  /**
   * Validates if a job can transition from its current status to a target status.
   */
  static validateTransition(currentStatus: JobStatus, targetStatus: JobStatus): boolean {
    return canTransitionJob(currentStatus, targetStatus);
  }

  /**
   * Prepares a typed database insert object with PostGIS spatial point for Supabase.
   */
  static prepareJobInsert(customerId: string, input: CreateJobInput): JobInsert {
    // Format as PostGIS WKT (Well-Known Text) point: POINT(longitude latitude)
    const pointWkt = `POINT(${input.longitude} ${input.latitude})`;
    // Reconcile with live PostgreSQL jobs_category_check constraint:
    // Permitted DB categories: 'plumbing', 'electrical', 'cleaning', 'carpentry', 'painting', 'appliance_repair', 'cooking'
    let dbCategory = input.category.toLowerCase().trim();
    let displayTitle = input.title.trim();
    if (displayTitle.length < 5) {
      displayTitle = `${displayTitle} Service`;
    }
    const rawDesc = input.description?.trim();

    // Reconcile with live PostgreSQL jobs_description_check constraint (requires length(trim(description)) >= 15):
    let displayDesc: string;
    if (rawDesc && rawDesc.length >= 15) {
      displayDesc = rawDesc;
    } else if (rawDesc && rawDesc.length > 0) {
      // Preserve customer's brief description while ensuring length meets database constraint
      displayDesc = `${rawDesc} - Service request for ${displayTitle} in ${input.city || 'local area'}.`;
    } else {
      // Optional description omitted: construct safe, informative default from title and city
      displayDesc = `Service request for ${displayTitle} in ${input.city || 'local area'} - Professional assistance requested.`;
    }

    if (input.category === 'maid') {
      // 'maid' (house help) maps to 'cleaning' in the database constraint while preserving full display semantics
      dbCategory = 'cleaning';
    } else if (input.category === 'other' || input.category === 'custom') {
      const customName = input.customCategoryName?.trim() || 'Custom Service';
      // Clean up custom title
      if (!displayTitle.toLowerCase().includes(customName.toLowerCase())) {
        displayTitle = `${customName}: ${displayTitle}`;
      }
      displayDesc = `[Custom Service: ${customName}] ${displayDesc}`;
      // Map to 'cleaning' or most appropriate general trades category if database constraint rejects unlisted strings
      dbCategory = 'cleaning';
    }

    // Reconcile with live PostgreSQL jobs_urgency_check constraint:
    // Permitted DB urgencies: 'standard', 'urgent', 'emergency'
    let dbUrgency = (input.urgency || 'standard').toLowerCase().trim();
    if (dbUrgency === 'same_day' || dbUrgency === 'sameday' || dbUrgency === 'same day') {
      dbUrgency = 'urgent';
    } else if (dbUrgency !== 'standard' && dbUrgency !== 'emergency' && dbUrgency !== 'urgent') {
      dbUrgency = 'standard';
    }

    return {
      customer_id: customerId,
      category: dbCategory,
      title: displayTitle,
      description: displayDesc,
      urgency: dbUrgency as JobUrgency,
      status: ((input as { status?: JobStatus }).status ?? 'posted') as JobStatus,
      location_point: pointWkt,
      service_location: pointWkt,
      address_line: input.addressLine,
      landmark: input.landmark ?? null,
      city: input.city,
      pincode: input.pincode,
      estimated_min_price_inr: input.estimatedMinPriceInr ?? input.estimatedBudgetInr ?? null,
      estimated_max_price_inr: input.estimatedMaxPriceInr ?? null,
      scheduled_date: input.scheduledDate ?? null,
      scheduled_time_slot: input.scheduledTimeSlot ?? null,
      photo_urls: input.photoUrls && Array.isArray(input.photoUrls) ? input.photoUrls : [],
      ai_details: ((input as { aiDetails?: Json }).aiDetails ?? {}) as Json,
    };
  }

  /**
   * Prepares a typed bid insert object for Supabase.
   */
  static prepareBidInsert(input: CreateBidInput): BidInsert {
    return {
      job_id: input.jobId,
      worker_id: input.workerId,
      offered_amount_inr: input.offeredAmountInr,
      proposed_amount: input.offeredAmountInr,
      labor_cost_inr: input.laborCostInr,
      materials_estimate_inr: input.materialsEstimateInr ?? 0,
      visitation_fee_inr: input.visitationFeeInr ?? 0,
      note: input.note ?? null,
      status: 'PENDING',
      counter_offers: [],
    };
  }

  /**
   * Fetches job details by ID.
   */
  static async fetchJobById(
    supabase: SupabaseClient<Database>,
    jobId: string
  ): Promise<JobRow | null> {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('[JobsService] Error fetching job:', error.message);
      return null;
    }

    return data;
  }

  /**
   * Fetches all active bids for a specific job (RLS will restrict based on customer/worker role).
   */
  static async fetchBidsForJob(
    supabase: SupabaseClient<Database>,
    jobId: string
  ): Promise<BidRow[]> {
    const { data, error } = await supabase
      .from('bids')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[JobsService] Error fetching bids for job:', error.message);
      return [];
    }

    return data ?? [];
  }
}
