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
      host_leads: {
        Row: {
          id: string;
          name: string;
          business_name: string;
          venue_type: string;
          city: string;
          email: string;
          phone: string | null;
          foot_traffic: string;
          hours_of_access: string | null;
          placement_outlet: string | null;
          sells_cards: string | null;
          priority: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_name: string;
          venue_type: string;
          city: string;
          email: string;
          phone?: string | null;
          foot_traffic: string;
          hours_of_access?: string | null;
          placement_outlet?: string | null;
          sells_cards?: string | null;
          priority?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          name: string;
          business_name: string;
          venue_type: string;
          city: string;
          email: string;
          phone: string | null;
          foot_traffic: string;
          hours_of_access: string | null;
          placement_outlet: string | null;
          sells_cards: string | null;
          priority: string | null;
          notes: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      machine_restock_alerts: {
        Row: {
          id: string;
          email: string;
          location_key: string | null;
          product_scope: string;
          city: string | null;
          tier: string;
          created_at: string;
          last_notified_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          location_key?: string | null;
          product_scope?: string;
          city?: string | null;
          tier?: string;
          created_at?: string;
          last_notified_at?: string | null;
        };
        Update: Partial<{
          id: string;
          email: string;
          location_key: string | null;
          product_scope: string;
          city: string | null;
          tier: string;
          created_at: string;
          last_notified_at: string | null;
        }>;
        Relationships: [];
      };
      watchlists: {
        Row: {
          id: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          variant: string;
          condition: string;
          created_at: string;
          last_notified_at: string | null;
          src: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          variant?: string;
          condition?: string;
          created_at?: string;
          last_notified_at?: string | null;
          src?: string | null;
        };
        Update: Partial<{
          id: string;
          email: string;
          card_slug: string;
          target_price_cents: number;
          variant: string;
          condition: string;
          created_at: string;
          last_notified_at: string | null;
          src: string | null;
        }>;
        Relationships: [];
      };
      browse_calls: {
        Row: {
          id: number;
          called_at: string;
          surface: "page_render" | "wishlist_cron" | "deals_cron" | "deals_redirect" | "manual";
          success: boolean;
          latency_ms: number;
        };
        Insert: {
          id?: number;
          called_at?: string;
          surface: "page_render" | "wishlist_cron" | "deals_cron" | "deals_redirect" | "manual";
          success: boolean;
          latency_ms: number;
        };
        Update: Partial<{
          id: number;
          called_at: string;
          surface: "page_render" | "wishlist_cron" | "deals_cron" | "deals_redirect" | "manual";
          success: boolean;
          latency_ms: number;
        }>;
        Relationships: [];
      };
      buy_signals: {
        Row: {
          card_slug: string;
          card_name: string;
          set_name: string;
          image_url: string;
          signal: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
          delta_pct: number | null;
          sold_reference: number | null;
          sold_sample_size: number;
          matched_tier: string | null;
          computed_at: string;
        };
        Insert: {
          card_slug: string;
          card_name?: string;
          set_name?: string;
          image_url?: string;
          signal: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
          delta_pct?: number | null;
          sold_reference?: number | null;
          sold_sample_size?: number;
          matched_tier?: string | null;
          computed_at?: string;
        };
        Update: Partial<{
          card_slug: string;
          card_name: string;
          set_name: string;
          image_url: string;
          signal: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
          delta_pct: number | null;
          sold_reference: number | null;
          sold_sample_size: number;
          matched_tier: string | null;
          computed_at: string;
        }>;
        Relationships: [];
      };
      market_movers: {
        Row: {
          card_slug: string;
          card_name: string;
          set_name: string;
          image_url: string;
          direction: "down" | "up" | "flat";
          momentum_pct: number;
          avg7d: number | null;
          avg30d: number | null;
          sale_count: number;
          matched_tier: string;
          computed_at: string;
        };
        Insert: {
          card_slug: string;
          card_name?: string;
          set_name?: string;
          image_url?: string;
          direction: "down" | "up" | "flat";
          momentum_pct: number;
          avg7d?: number | null;
          avg30d?: number | null;
          sale_count?: number;
          matched_tier?: string;
          computed_at?: string;
        };
        Update: Partial<{
          card_slug: string;
          card_name: string;
          set_name: string;
          image_url: string;
          direction: "down" | "up" | "flat";
          momentum_pct: number;
          avg7d: number | null;
          avg30d: number | null;
          sale_count: number;
          matched_tier: string;
          computed_at: string;
        }>;
        Relationships: [];
      };
      market_snapshots: {
        Row: {
          id: number;
          card_slug: string;
          snapshot_date: string;
          avg7d: number | null;
          avg30d: number | null;
          sale_count: number;
          matched_tier: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          card_slug: string;
          snapshot_date: string;
          avg7d?: number | null;
          avg30d?: number | null;
          sale_count?: number;
          matched_tier?: string;
          source?: string;
          created_at?: string;
        };
        Update: Partial<{
          id: number;
          card_slug: string;
          snapshot_date: string;
          avg7d: number | null;
          avg30d: number | null;
          sale_count: number;
          matched_tier: string;
          source: string;
          created_at: string;
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
