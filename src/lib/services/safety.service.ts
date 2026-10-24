/**
 * Safety & Verification Service
 * Server-side cryptographic OTP generation, salted hash storage, and SOS event dispatches.
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database, VerificationType } from '@/types/database.types';
import { OtpType } from '@/types/safety';

export type JobVerificationInsert =
  Database['public']['Tables']['job_verifications']['Insert'];

export class SafetyService {
  /**
   * Generates a cryptographically randomized 4-digit numeric OTP for job milestone handoffs.
   */
  static generateJobOtp(): string {
    const randomBytes = crypto.randomInt(1000, 10000);
    return randomBytes.toString();
  }

  /**
   * Generates a random cryptographic salt for OTP hashing.
   */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hashes an OTP with a record-specific salt using SHA-256.
   */
  static hashOtp(otp: string, salt: string): string {
    return crypto
      .createHash('sha256')
      .update(otp.trim() + salt)
      .digest('hex');
  }

  /**
   * Prepares a secure verification record without storing plain-text OTPs.
   * Returns both the plain-text OTP (to deliver directly via SMS/in-app notification to the customer)
   * and the hashed database payload to persist.
   */
  static prepareOtpRecord(
    jobId: string,
    verificationType: VerificationType,
    validityMinutes = 60
  ): { plainTextOtp: string; dbInsert: JobVerificationInsert } {
    const plainTextOtp = this.generateJobOtp();
    const salt = this.generateSalt();
    const otpHash = this.hashOtp(plainTextOtp, salt);

    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

    return {
      plainTextOtp,
      dbInsert: {
        job_id: jobId,
        verification_type: verificationType,
        otp_hash: otpHash,
        salt,
        attempts: 0,
        max_attempts: 5,
        expires_at: expiresAt,
      },
    };
  }

  /**
   * Verifies an OTP via the secure server-side RPC database function.
   */
  static async verifyOtpViaRpc(
    supabase: SupabaseClient<Database>,
    jobId: string,
    type: VerificationType,
    otpCode: string
  ): Promise<{ success: boolean; error?: string; remaining_attempts?: number }> {
    const { data, error } = await supabase.rpc('verify_job_otp', {
      p_job_id: jobId,
      p_type: type,
      p_otp_code: otpCode.trim(),
    });

    if (error) {
      console.error('[SafetyService] Error calling verify_job_otp RPC:', error.message);
      return { success: false, error: error.message };
    }

    return (data as { success: boolean; error?: string; remaining_attempts?: number }) ?? {
      success: false,
      error: 'Unknown verification response',
    };
  }

  /**
   * Offline / In-memory validation if comparing against known timestamp and code.
   */
  static verifyOtp(suppliedOtp: string, expectedOtp: string, expiresAt: Date): boolean {
    if (new Date() > expiresAt) {
      return false;
    }
    return suppliedOtp.trim() === expectedOtp.trim();
  }

  /**
   * Returns human-readable description for an OTP milestone.
   */
  static getOtpMilestoneDescription(type: OtpType | VerificationType): string {
    return type === 'JOB_START'
      ? 'Start OTP: Reveals authorization when the verified worker arrives at the site.'
      : 'Completion OTP: Releases payment authorization after customer inspects finished work.';
  }
}
