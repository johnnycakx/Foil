// Minimal Supabase type bindings so the generic clients accept upsert/update
// payloads for our tables. Replace with `supabase gen types typescript ...`
// output once we wire the CLI.

export type Database = {
  public: {
    Tables: {
      scans: {
        Row: {
          id: string;
          user_id: string;
          scanned_at: string;
          image_metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          user_id: string;
          scanned_at?: string;
          image_metadata?: Record<string, unknown>;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          scanned_at: string;
          image_metadata: Record<string, unknown>;
        }>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          tier: "free" | "pro";
          status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          tier?: "free" | "pro";
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          user_id: string;
          tier: "free" | "pro";
          status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      match_confirmations: {
        Row: {
          id: string;
          user_id: string;
          scan_id: string | null;
          card_id: string | null;
          matched_image_url: string | null;
          card_name: string | null;
          card_set: string | null;
          card_number: string | null;
          user_confirmed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scan_id?: string | null;
          card_id?: string | null;
          matched_image_url?: string | null;
          card_name?: string | null;
          card_set?: string | null;
          card_number?: string | null;
          user_confirmed: boolean;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          scan_id: string | null;
          card_id: string | null;
          matched_image_url: string | null;
          card_name: string | null;
          card_set: string | null;
          card_number: string | null;
          user_confirmed: boolean;
          created_at: string;
        }>;
        Relationships: [];
      };
      corrections: {
        Row: {
          id: string;
          user_id: string;
          submitted_at: string;
          original_name: string | null;
          original_set: string | null;
          original_card_number: string | null;
          corrected_name: string | null;
          corrected_set: string | null;
          corrected_card_number: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          submitted_at?: string;
          original_name?: string | null;
          original_set?: string | null;
          original_card_number?: string | null;
          corrected_name?: string | null;
          corrected_set?: string | null;
          corrected_card_number?: string | null;
          notes?: string | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          submitted_at: string;
          original_name: string | null;
          original_set: string | null;
          original_card_number: string | null;
          corrected_name: string | null;
          corrected_set: string | null;
          corrected_card_number: string | null;
          notes: string | null;
        }>;
        Relationships: [];
      };
      waitlist: {
        Row: {
          id: string;
          email: string;
          signed_up_at: string;
          source: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          landing_page: string | null;
          referrer: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          signed_up_at?: string;
          source?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          landing_page?: string | null;
          referrer?: string | null;
        };
        Update: Partial<{
          id: string;
          email: string;
          signed_up_at: string;
          source: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          landing_page: string | null;
          referrer: string | null;
        }>;
        Relationships: [];
      };
      pricecharting_id_map: {
        Row: {
          poketrace_id: string;
          pricecharting_id: string;
          pricecharting_name: string;
          console_name: string;
          last_synced: string;
        };
        Insert: {
          poketrace_id: string;
          pricecharting_id: string;
          pricecharting_name: string;
          console_name: string;
          last_synced?: string;
        };
        Update: Partial<{
          poketrace_id: string;
          pricecharting_id: string;
          pricecharting_name: string;
          console_name: string;
          last_synced: string;
        }>;
        Relationships: [];
      };
      watchlists: {
        Row: {
          id: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          created_at: string;
          last_notified_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          created_at?: string;
          last_notified_at?: string | null;
        };
        Update: Partial<{
          id: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          created_at: string;
          last_notified_at: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
