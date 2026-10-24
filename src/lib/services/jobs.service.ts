/**
 * Jobs Service
 * Server-side service orchestrating job creation, bidding, and state-machine transitions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, JobStatus } from '@/types/database.types';
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
    return {
      customer_id: customerId,
      category: input.category,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      status: 'POSTED',
      // Format as WKT (Well-Known Text) point: POINT(longitude latitude)
      location_point: `POINT(${input.longitude} ${input.latitude})`,
      address_line: input.addressLine,
      landmark: input.landmark ?? null,
      city: input.city,
      pincode: input.pincode,
      estimated_min_price_inr: input.estimatedMinPriceInr ?? input.estimatedBudgetInr ?? null,
      estimated_max_price_inr: input.estimatedMaxPriceInr ?? null,
      scheduled_date: input.scheduledDate ?? null,
      scheduled_time_slot: input.scheduledTimeSlot ?? null,
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
