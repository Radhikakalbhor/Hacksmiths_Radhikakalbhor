/**
 * Booking Service
 * Server-side management of instant booking, lifecycle transitions,
 * cryptographic OTP handoffs, simulated/real worker tracking, and messages.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { BookingStage, BookingState, ChatMessage, canTransitionBooking } from '@/types/booking';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export class BookingService {
  /**
   * Generates a secure, unpredictable 4-digit numeric OTP.
   */
  static generateOtpCode(): string {
    return crypto.randomInt(1000, 10000).toString();
  }

  /**
   * Generates a random cryptographic salt.
   */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hashes an OTP code with salt using SHA-256.
   */
  static hashOtp(otp: string, salt: string): string {
    return crypto
      .createHash('sha256')
      .update(otp.trim() + salt)
      .digest('hex');
  }

  /**
   * Creates or updates a secure arrival OTP record for a job.
   * Only the plain-text OTP is returned to the calling customer API to show on screen.
   * Only the salted hash is stored in PostgreSQL.
   */
  static async provisionJobStartOtp(
    supabase: SupabaseClient<Database>,
    jobId: string
  ): Promise<{ plainOtp: string; expiresAt: string }> {
    const plainOtp = this.generateOtpCode();
    const salt = this.generateSalt();
    const otpHash = this.hashOtp(plainOtp, salt);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity

    // Upsert into public.job_verifications
    // Use privileged admin client if available to satisfy RLS security policy
    const adminClient = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (adminClient || supabase) as any;
    await client.from('job_verifications').delete().eq('job_id', jobId).eq('purpose', 'job_start');

    const { error } = await client.from('job_verifications').insert({
      job_id: jobId,
      purpose: 'job_start',
      verification_type: 'JOB_START',
      otp_hash: otpHash,
      salt: salt,
      expires_at: expiresAt,
      max_attempts: 5,
      attempts: 0,
    });

    if (error) {
      console.warn('[BookingService] Error inserting job_verifications:', error.message);
    }

    return { plainOtp, expiresAt };
  }

  /**
   * Validates a worker-submitted OTP code server-side against the stored cryptographic hash.
   */
  static async verifyJobStartOtp(
    supabase: SupabaseClient<Database>,
    jobId: string,
    submittedCode: string
  ): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
    const adminClient = getSupabaseAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (adminClient || supabase) as any;
    const { data: records, error } = await client
      .from('job_verifications')
      .select('*')
      .eq('job_id', jobId)
      .eq('purpose', 'job_start')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !records || records.length === 0) {
      return { success: false, error: 'No active OTP verification found for this service request.' };
    }

    const rec = records[0];

    if (rec.verified_at) {
      return { success: false, error: 'This service start OTP has already been verified.' };
    }

    if (new Date() > new Date(rec.expires_at)) {
      return { success: false, error: 'This OTP has expired. Please request the customer for a fresh code.' };
    }

    const currentAttempts = (rec.attempts ?? 0) + 1;
    if (currentAttempts > (rec.max_attempts ?? 5)) {
      return { success: false, error: 'Too many incorrect attempts. Verification is locked.' };
    }

    const testHash = this.hashOtp(submittedCode, rec.salt);
    if (testHash !== rec.otp_hash) {
      // Increment attempt count
      await client
        .from('job_verifications')
        .update({ attempts: currentAttempts })
        .eq('id', rec.id);

      const remaining = Math.max(0, (rec.max_attempts ?? 5) - currentAttempts);
      return {
        success: false,
        error: `Incorrect OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        remainingAttempts: remaining,
      };
    }

    // Success! Mark verified
    await client
      .from('job_verifications')
      .update({ verified_at: new Date().toISOString(), attempts: currentAttempts })
      .eq('id', rec.id);

    return { success: true };
  }

  /**
   * Reads the current booking state from the job's ai_details JSONB metadata.
   */
  static extractBookingState(job: {
    status: string;
    ai_details?: unknown;
    accepted_price_inr?: number | null;
  }): BookingState | null {
    const aiDetails = (job.ai_details && typeof job.ai_details === 'object' ? job.ai_details : {}) as Record<string, unknown>;
    const booking = aiDetails.booking as BookingState | undefined;
    if (!booking) return null;
    return booking;
  }

  /**
   * Updates booking stage and transitions state.
   */
  static async updateBookingStage(
    supabase: SupabaseClient<Database>,
    jobId: string,
    currentJob: {
      status: string;
      ai_details?: unknown;
    },
    targetStage: BookingStage,
    cancellationReason?: string
  ): Promise<{ success: boolean; error?: string; booking?: BookingState }> {
    const aiDetails = (currentJob.ai_details && typeof currentJob.ai_details === 'object' ? currentJob.ai_details : {}) as Record<string, unknown>;
    const currentBooking = (aiDetails.booking as BookingState) || null;

    if (!currentBooking) {
      return { success: false, error: 'No active booking exists on this job.' };
    }

    if (!canTransitionBooking(currentBooking.stage, targetStage)) {
      return {
        success: false,
        error: `Invalid status transition from '${currentBooking.stage}' to '${targetStage}'.`,
      };
    }

    const updatedBooking: BookingState = {
      ...currentBooking,
      stage: targetStage,
      stageUpdatedAt: new Date().toISOString(),
      cancellationReason: cancellationReason || currentBooking.cancellationReason || null,
    };

    if (targetStage === 'in_progress') {
      updatedBooking.otpVerified = true;
      updatedBooking.verifiedAt = new Date().toISOString();
    }

    // Map to valid PostgreSQL status enum/check (strictly lowercase in live schema)
    let dbStatus: Database['public']['Enums']['job_status'] = 'assigned';
    if (targetStage === 'in_progress') {
      dbStatus = 'in_progress';
    } else if (targetStage === 'completed') {
      dbStatus = 'completed';
    } else if (targetStage === 'cancelled') {
      dbStatus = 'cancelled';
    } else if (['accepted', 'on_the_way', 'arrived'].includes(targetStage)) {
      dbStatus = 'assigned';
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        status: dbStatus,
        ai_details: {
          ...aiDetails,
          booking: updatedBooking,
        } as any,
      })
      .eq('id', jobId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, booking: updatedBooking };
  }

  /**
   * Retrieves messages for a specific job booking.
   */
  static async fetchMessages(
    supabase: SupabaseClient<Database>,
    jobId: string
  ): Promise<ChatMessage[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    // Check job_messages table first
    const { data: tableData, error } = await client
      .from('job_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(tableData) && tableData.length > 0) {
      return (tableData as Array<{
        id: string;
        job_id: string;
        sender_id: string;
        sender_role: 'customer' | 'worker' | 'system';
        message_text: string;
        created_at: string;
        is_read: boolean;
      }>).map((m) => ({
        id: m.id,
        jobId: m.job_id,
        senderId: m.sender_id,
        senderRole: m.sender_role,
        senderName: m.sender_role === 'customer' ? 'Customer' : 'Professional',
        text: m.message_text,
        createdAt: m.created_at,
        isRead: m.is_read,
      }));
    }

    // Fallback: Read from jobs.ai_details.chat_messages
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
    const rawAi = (jobData as { ai_details?: unknown })?.ai_details;
    if (rawAi && typeof rawAi === 'object') {
      const details = rawAi as { chat_messages?: ChatMessage[] };
      return details.chat_messages || [];
    }

    return [];
  }

  /**
   * Appends a chat message to the booking conversation.
   */
  static async postMessage(
    supabase: SupabaseClient<Database>,
    jobId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    // 1. Try writing to public.job_messages table if it exists
    const { error: tableError } = await client
      .from('job_messages')
      .insert({
        id: newMessage.id,
        job_id: jobId,
        sender_id: newMessage.senderId,
        sender_role: newMessage.senderRole,
        message_text: newMessage.text,
        is_read: false,
      });

    if (!tableError) {
      return { success: true, message: newMessage };
    }

    // 2. Persisted fallback: Write to jobs.ai_details.chat_messages
    const { data: jobData, error: jobFetchErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobFetchErr || !jobData) {
      return { success: false, error: 'Job not found for messaging.' };
    }

    const rawAi = (jobData as { ai_details?: unknown })?.ai_details;
    const aiDetails = (rawAi && typeof rawAi === 'object' ? rawAi : {}) as Record<string, unknown>;
    const existingMessages = (aiDetails.chat_messages as ChatMessage[]) || [];
    const updatedMessages = [...existingMessages, newMessage];

    const { error: updateErr } = await supabase
      .from('jobs')
      .update({
        ai_details: {
          ...aiDetails,
          chat_messages: updatedMessages,
        } as any,
      })
      .eq('id', jobId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, message: newMessage };
  }
}
