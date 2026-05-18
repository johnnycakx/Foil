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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
