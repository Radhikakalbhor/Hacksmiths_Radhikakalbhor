/**
 * Supabase Database Type Definitions
 * Generated and synchronized with migrations under /supabase/migrations/
 * Compatible with Supabase PostgREST v12 GenericSchema requirements.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'worker' | 'admin';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended';
export type JobUrgency = 'standard' | 'same_day' | 'urgent' | 'emergency';
export type JobStatus =
  | 'draft'
  | 'posted'
  | 'bidding_open'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'DRAFT'
  | 'POSTED'
  | 'BIDDING_OPEN'
  | 'ASSIGNED'
  | 'OTP_START_VERIFIED'
  | 'IN_PROGRESS'
  | 'OTP_COMPLETION_VERIFIED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';
export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export type VerificationType = 'JOB_START' | 'JOB_COMPLETION';
export type SafetySeverity = 'URGENT_EMERGENCY' | 'SAFETY_CHECK' | 'DISPUTE_ESCALATION';
export type SafetyEventStatus = 'TRIGGERED' | 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string;
          email: string | null;
          full_name: string;
          avatar_url: string | null;
          role: UserRole;
          verification_status: VerificationStatus;
          primary_city: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone: string;
          email?: string | null;
          full_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          verification_status?: VerificationStatus;
          primary_city?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          phone?: string;
          email?: string | null;
          full_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          verification_status?: VerificationStatus;
          primary_city?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      worker_profiles: {
        Row: {
          id: string;
          user_id: string;
          primary_category: string;
          skills: string[];
          bio: string | null;
          years_experience: number;
          service_radius_km: number;
          hourly_rate_inr: number | null;
          fixed_rate_estimate_inr: number | null;
          is_available: boolean;
          is_publicly_visible: boolean;
          government_id_verified: boolean;
          background_check_verified: boolean;
          reputation_score: number;
          total_completed_jobs: number;
          service_location: unknown | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          primary_category: string;
          skills?: string[];
          bio?: string | null;
          years_experience?: number;
          service_radius_km?: number;
          hourly_rate_inr?: number | null;
          fixed_rate_estimate_inr?: number | null;
          is_available?: boolean;
          is_publicly_visible?: boolean;
          government_id_verified?: boolean;
          background_check_verified?: boolean;
          reputation_score?: number;
          total_completed_jobs?: number;
          service_location?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          primary_category?: string;
          skills?: string[];
          bio?: string | null;
          years_experience?: number;
          service_radius_km?: number;
          hourly_rate_inr?: number | null;
          fixed_rate_estimate_inr?: number | null;
          is_available?: boolean;
          is_publicly_visible?: boolean;
          government_id_verified?: boolean;
          background_check_verified?: boolean;
          reputation_score?: number;
          total_completed_jobs?: number;
          service_location?: unknown | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          customer_id: string;
          selected_worker_id: string | null;
          accepted_bid_id: string | null;
          category: string;
          title: string;
          description: string;
          urgency: JobUrgency;
          status: JobStatus;
          location_point: unknown;
          service_location: unknown;
          address_line: string;
          landmark: string | null;
          city: string;
          pincode: string;
          estimated_budget_inr?: number | null;
          estimated_min_price_inr: number | null;
          estimated_max_price_inr: number | null;
          accepted_price_inr: number | null;
          scheduled_date: string | null;
          scheduled_time_slot: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          started_at?: string | null;
          photo_urls?: string[] | null;
          ai_details: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          selected_worker_id?: string | null;
          accepted_bid_id?: string | null;
          category: string;
          title: string;
          description: string;
          urgency?: JobUrgency;
          status?: JobStatus;
          location_point?: unknown;
          service_location?: unknown;
          address_line: string;
          landmark?: string | null;
          city: string;
          pincode: string;
          estimated_budget_inr?: number | null;
          estimated_min_price_inr?: number | null;
          estimated_max_price_inr?: number | null;
          accepted_price_inr?: number | null;
          scheduled_date?: string | null;
          scheduled_time_slot?: string | null;
          photo_urls?: string[] | null;
          ai_details?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          selected_worker_id?: string | null;
          accepted_bid_id?: string | null;
          category?: string;
          title?: string;
          description?: string;
          urgency?: JobUrgency;
          status?: JobStatus;
          location_point?: unknown;
          service_location?: unknown;
          address_line?: string;
          landmark?: string | null;
          city?: string;
          pincode?: string;
          photo_urls?: string[] | null;
          estimated_budget_inr?: number | null;
          estimated_min_price_inr?: number | null;
          estimated_max_price_inr?: number | null;
          accepted_price_inr?: number | null;
          scheduled_date?: string | null;
          scheduled_time_slot?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          started_at?: string | null;
          ai_details?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_selected_worker_id_fkey';
            columns: ['selected_worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_jobs_accepted_bid';
            columns: ['accepted_bid_id'];
            isOneToOne: false;
            referencedRelation: 'bids';
            referencedColumns: ['id'];
          },
        ];
      };
      bids: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          offered_amount_inr: number;
          proposed_amount?: number;
          labor_cost_inr: number;
          materials_estimate_inr: number;
          visitation_fee_inr: number;
          note: string | null;
          counter_offers: Json;
          status: BidStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          worker_id: string;
          offered_amount_inr: number;
          proposed_amount?: number;
          labor_cost_inr?: number;
          materials_estimate_inr?: number;
          visitation_fee_inr?: number;
          note?: string | null;
          counter_offers?: Json;
          status?: BidStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          offered_amount_inr?: number;
          proposed_amount?: number;
          labor_cost_inr?: number;
          materials_estimate_inr?: number;
          visitation_fee_inr?: number;
          note?: string | null;
          counter_offers?: Json;
          status?: BidStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bids_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      price_benchmarks: {
        Row: {
          id: string;
          category: string;
          city: string;
          micro_market_area: string;
          min_price_inr: number;
          median_price_inr: number;
          max_price_inr: number;
          sample_size: number;
          currency: string;
          is_demo_estimate: boolean;
          last_calculated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          city: string;
          micro_market_area: string;
          min_price_inr: number;
          median_price_inr: number;
          max_price_inr: number;
          sample_size?: number;
          currency?: string;
          is_demo_estimate?: boolean;
          last_calculated_at?: string;
        };
        Update: {
          min_price_inr?: number;
          median_price_inr?: number;
          max_price_inr?: number;
          sample_size?: number;
          currency?: string;
          is_demo_estimate?: boolean;
          last_calculated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          job_id: string;
          customer_id: string;
          worker_id: string;
          rating: number;
          punctuality_rating: number | null;
          quality_rating: number | null;
          rating_overall: number | null;
          rating_punctuality: number | null;
          rating_work_quality: number | null;
          rating_behavior: number | null;
          review_text: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          customer_id: string;
          worker_id: string;
          rating: number;
          punctuality_rating?: number | null;
          quality_rating?: number | null;
          rating_overall?: number | null;
          rating_punctuality?: number | null;
          rating_work_quality?: number | null;
          rating_behavior?: number | null;
          review_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          rating?: number;
          punctuality_rating?: number | null;
          quality_rating?: number | null;
          rating_overall?: number | null;
          rating_punctuality?: number | null;
          rating_work_quality?: number | null;
          rating_behavior?: number | null;
          review_text?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      job_verifications: {
        Row: {
          id: string;
          job_id: string;
          purpose: string | null;
          verification_type: VerificationType;
          otp_hash: string;
          salt: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          purpose?: string | null;
          verification_type: VerificationType;
          otp_hash: string;
          salt: string;
          attempts?: number;
          max_attempts?: number;
          expires_at: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          purpose?: string | null;
          attempts?: number;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_verifications_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      safety_events: {
        Row: {
          id: string;
          triggered_by_user_id: string;
          job_id: string | null;
          severity: SafetySeverity;
          status: SafetyEventStatus;
          location_point: unknown | null;
          details: Json;
          trusted_contacts_notified: number;
          resolved_at: string | null;
          resolver_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          triggered_by_user_id: string;
          job_id?: string | null;
          severity?: SafetySeverity;
          status?: SafetyEventStatus;
          location_point?: unknown | null;
          details?: Json;
          trusted_contacts_notified?: number;
          resolved_at?: string | null;
          resolver_notes?: string | null;
          created_at?: string;
        };
        Update: {
          status?: SafetyEventStatus;
          resolved_at?: string | null;
          resolver_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'safety_events_triggered_by_user_id_fkey';
            columns: ['triggered_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'safety_events_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_earnings: {
        Row: {
          id: string;
          worker_id: string;
          job_id: string;
          gross_amount_inr: number;
          platform_fee_inr: number;
          net_payout_inr: number;
          status: 'PENDING' | 'PROCESSED' | 'FAILED';
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          job_id: string;
          gross_amount_inr: number;
          platform_fee_inr?: number;
          net_payout_inr: number;
          status?: 'PENDING' | 'PROCESSED' | 'FAILED';
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'PENDING' | 'PROCESSED' | 'FAILED';
          paid_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_earnings_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_earnings_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      worker_wallets: {
        Row: {
          id: string;
          worker_id: string;
          available_balance_inr: number;
          pending_balance_inr: number;
          total_earned_inr: number;
          total_withdrawn_inr: number;
          total_deductions_inr: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          available_balance_inr?: number;
          pending_balance_inr?: number;
          total_earned_inr?: number;
          total_withdrawn_inr?: number;
          total_deductions_inr?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          available_balance_inr?: number;
          pending_balance_inr?: number;
          total_earned_inr?: number;
          total_withdrawn_inr?: number;
          total_deductions_inr?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_wallets_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          id: string;
          wallet_id: string;
          worker_id: string;
          job_id: string | null;
          transaction_type: 'JOB_PAYOUT' | 'COMMISSION_DEDUCTION' | 'PENALTY_DEDUCTION' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';
          amount_inr: number;
          balance_after_inr: number;
          status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
          description: string;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          worker_id: string;
          job_id?: string | null;
          transaction_type: 'JOB_PAYOUT' | 'COMMISSION_DEDUCTION' | 'PENALTY_DEDUCTION' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';
          amount_inr: number;
          balance_after_inr: number;
          status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
          description: string;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
          description?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallet_transactions_wallet_id_fkey';
            columns: ['wallet_id'];
            isOneToOne: false;
            referencedRelation: 'worker_wallets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallet_transactions_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_payout_methods: {
        Row: {
          id: string;
          worker_id: string;
          method_type: 'UPI' | 'BANK_ACCOUNT';
          account_holder_name: string;
          upi_id: string | null;
          bank_name: string | null;
          account_number_masked: string | null;
          ifsc_code: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          method_type: 'UPI' | 'BANK_ACCOUNT';
          account_holder_name: string;
          upi_id?: string | null;
          bank_name?: string | null;
          account_number_masked?: string | null;
          ifsc_code?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_holder_name?: string;
          upi_id?: string | null;
          bank_name?: string | null;
          account_number_masked?: string | null;
          ifsc_code?: string | null;
          is_primary?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_payout_methods_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      withdrawal_requests: {
        Row: {
          id: string;
          worker_id: string;
          wallet_id: string;
          amount_inr: number;
          payout_method_type: 'UPI' | 'BANK_ACCOUNT';
          payout_details: Json;
          status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
          admin_notes: string | null;
          payout_reference: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          wallet_id: string;
          amount_inr: number;
          payout_method_type: 'UPI' | 'BANK_ACCOUNT';
          payout_details?: Json;
          status?: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
          admin_notes?: string | null;
          payout_reference?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
          admin_notes?: string | null;
          payout_reference?: string | null;
          processed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'withdrawal_requests_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      job_payments: {
        Row: {
          id: string;
          job_id: string;
          customer_id: string;
          worker_id: string;
          gross_amount_inr: number;
          commission_rate_percent: number;
          commission_amount_inr: number;
          worker_net_earning_inr: number;
          payment_status: 'HELD_IN_ESCROW' | 'PENDING_RELEASE' | 'RELEASED_TO_WALLET' | 'REFUNDED' | 'DISPUTED';
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          customer_id: string;
          worker_id: string;
          gross_amount_inr: number;
          commission_rate_percent?: number;
          commission_amount_inr?: number;
          worker_net_earning_inr: number;
          payment_status?: 'HELD_IN_ESCROW' | 'PENDING_RELEASE' | 'RELEASED_TO_WALLET' | 'REFUNDED' | 'DISPUTED';
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          gross_amount_inr?: number;
          commission_rate_percent?: number;
          commission_amount_inr?: number;
          worker_net_earning_inr?: number;
          payment_status?: 'HELD_IN_ESCROW' | 'PENDING_RELEASE' | 'RELEASED_TO_WALLET' | 'REFUNDED' | 'DISPUTED';
          released_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_payments_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_notifications: {
        Row: {
          id: string;
          worker_id: string;
          type: 'NEW_OFFER' | 'OFFER_ACCEPTED' | 'OFFER_REJECTED' | 'BOOKING_CANCELLED' | 'UPCOMING_REMINDER' | 'COMPLETION_CONFIRMED' | 'PAYMENT_CREDITED' | 'WITHDRAWAL_STATUS' | 'SYSTEM';
          title: string;
          message: string;
          job_id: string | null;
          is_read: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          type: 'NEW_OFFER' | 'OFFER_ACCEPTED' | 'OFFER_REJECTED' | 'BOOKING_CANCELLED' | 'UPCOMING_REMINDER' | 'COMPLETION_CONFIRMED' | 'PAYMENT_CREDITED' | 'WITHDRAWAL_STATUS' | 'SYSTEM';
          title: string;
          message: string;
          job_id?: string | null;
          is_read?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_notifications_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_nearby_workers: {
        Args: {
          origin_lat: number;
          origin_lng: number;
          radius_meters: number;
          category_filter: string | null;
          max_results: number;
        };
        Returns: {
          worker_id: string;
          full_name: string;
          avatar_url: string | null;
          primary_category: string;
          skills: string[];
          bio: string | null;
          years_experience: number;
          hourly_rate_inr: number | null;
          fixed_rate_estimate_inr: number | null;
          reputation_score: number;
          total_completed_jobs: number;
          is_available: boolean;
          distance_meters: number;
        }[];
      };
      verify_job_otp: {
        Args: {
          p_job_id: string;
          p_type: VerificationType;
          p_otp_code: string;
        };
        Returns: Json;
      };
      accept_job_bid: {
        Args: {
          p_job_id: string;
          p_bid_id: string;
          p_customer_id: string;
        };
        Returns: Json;
      };
      get_or_create_worker_wallet: {
        Args: {
          p_worker_id: string;
        };
        Returns: Database['public']['Tables']['worker_wallets']['Row'];
      };
      credit_job_earnings_to_wallet: {
        Args: {
          p_job_id: string;
          p_commission_percent?: number | null;
        };
        Returns: Json;
      };
      request_wallet_withdrawal: {
        Args: {
          p_worker_id: string;
          p_amount: number;
          p_method_type: string;
          p_details: Json;
        };
        Returns: Json;
      };
      process_withdrawal_decision: {
        Args: {
          p_request_id: string;
          p_action: string;
          p_admin_notes?: string | null;
          p_payout_ref?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      job_urgency: JobUrgency;
      job_status: JobStatus;
      bid_status: BidStatus;
      verification_type: VerificationType;
      safety_severity: SafetySeverity;
      safety_event_status: SafetyEventStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
