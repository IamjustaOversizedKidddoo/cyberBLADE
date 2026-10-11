export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      operators: {
        Row: {
          id: string;
          handle: string;
          rank: number;
          ethics_accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          rank?: number;
          ethics_accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          rank?: number;
          ethics_accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          status: "in_progress" | "completed";
          checks_passed: string[];
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          status: "in_progress" | "completed";
          checks_passed?: string[];
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          status?: "in_progress" | "completed";
          checks_passed?: string[];
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lab_attempts: {
        Row: {
          id: string;
          user_id: string;
          lab_id: string;
          seed: string;
          mode: "practice" | "challenge";
          objectives_solved: string[];
          hints_used: number;
          started_at: string;
          expires_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          lab_id: string;
          seed: string;
          mode: "practice" | "challenge";
          objectives_solved?: string[];
          hints_used?: number;
          started_at?: string;
          expires_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          lab_id?: string;
          seed?: string;
          mode?: "practice" | "challenge";
          objectives_solved?: string[];
          hints_used?: number;
          started_at?: string;
          expires_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
        };
        Relationships: [];
      };
      xp_events: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: string;
          amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      rank_challenges: {
        Row: {
          id: string;
          user_id: string;
          rank: number;
          lab_attempt_id: string;
          status: "active" | "passed" | "failed";
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          rank: number;
          lab_attempt_id: string;
          status: "active" | "passed" | "failed";
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          rank?: number;
          lab_attempt_id?: string;
          status?: "active" | "passed" | "failed";
          finished_at?: string | null;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          severity: string;
          metadata: Json;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: string;
          severity?: string;
          metadata?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_type?: string;
          severity?: string;
          metadata?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      handler_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          estimated_cost_usd: number;
          request_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
          request_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
          request_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attempt_lockouts: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          locked_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          locked_until: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          challenge_id?: string;
          locked_until?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
