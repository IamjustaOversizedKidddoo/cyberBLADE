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
      review_items: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          lesson_id: string;
          ease_factor: number;
          interval_days: number;
          repetitions: number;
          lapses: number;
          due_at: string;
          last_reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          lesson_id: string;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          lapses?: number;
          due_at?: string;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          lesson_id?: string;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          lapses?: number;
          due_at?: string;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_events: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          grade: number;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          grade: number;
          reviewed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          grade?: number;
          reviewed_at?: string;
        };
        Relationships: [];
      };
      learning_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_reports: {
        Row: {
          id: string;
          user_id: string;
          exam_type: string;
          score: number;
          max_score: number;
          passed: boolean;
          notes: string | null;
          reported_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_type: string;
          score: number;
          max_score: number;
          passed: boolean;
          notes?: string | null;
          reported_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_type?: string;
          score?: number;
          max_score?: number;
          passed?: boolean;
          notes?: string | null;
          reported_at?: string;
        };
        Relationships: [];
      };
      soc_attempts: {
        Row: {
          id: string;
          user_id: string;
          scenario_id: string;
          seed: string;
          status: "in_progress" | "submitted" | "abandoned" | "expired";
          score_summary: Json | null;
          started_at: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scenario_id: string;
          seed?: string;
          status?: "in_progress" | "submitted" | "abandoned" | "expired";
          score_summary?: Json | null;
          started_at?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scenario_id?: string;
          seed?: string;
          status?: "in_progress" | "submitted" | "abandoned" | "expired";
          score_summary?: Json | null;
          started_at?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      soc_decisions: {
        Row: {
          id: string;
          attempt_id: string;
          alert_id: string;
          disposition: string;
          severity: string;
          escalate: boolean;
          target_tier: string | null;
          rationale: string;
          evidence_refs: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          alert_id: string;
          disposition: string;
          severity: string;
          escalate?: boolean;
          target_tier?: string | null;
          rationale: string;
          evidence_refs?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          alert_id?: string;
          disposition?: string;
          severity?: string;
          escalate?: boolean;
          target_tier?: string | null;
          rationale?: string;
          evidence_refs?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      soc_cases: {
        Row: {
          id: string;
          attempt_id: string;
          title: string;
          severity: string;
          status: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          title: string;
          severity?: string;
          status?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          title?: string;
          severity?: string;
          status?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      soc_case_alerts: {
        Row: {
          id: string;
          case_id: string;
          alert_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          alert_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          alert_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
