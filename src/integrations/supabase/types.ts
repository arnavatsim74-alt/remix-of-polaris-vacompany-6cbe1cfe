export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      aircraft: {
        Row: {
          cargo_capacity_kg: number | null
          created_at: string | null
          icao_code: string
          id: string
          image_url: string | null
          livery: string | null
          min_hours: number | null
          name: string
          passenger_capacity: number | null
          range_nm: number | null
          type: string
        }
        Insert: {
          cargo_capacity_kg?: number | null
          created_at?: string | null
          icao_code: string
          id?: string
          image_url?: string | null
          livery?: string | null
          min_hours?: number | null
          name: string
          passenger_capacity?: number | null
          range_nm?: number | null
          type: string
        }
        Update: {
          cargo_capacity_kg?: number | null
          created_at?: string | null
          icao_code?: string
          id?: string
          image_url?: string | null
          livery?: string | null
          min_hours?: number | null
          name?: string
          passenger_capacity?: number | null
          range_nm?: number | null
          type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_admin_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          pilot_id: string
          pirep_id: string | null
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          pilot_id: string
          pirep_id?: string | null
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          pilot_id?: string
          pirep_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completions_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completions_pirep_id_fkey"
            columns: ["pirep_id"]
            isOneToOne: false
            referencedRelation: "pireps"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string | null
          destination_icao: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          destination_icao?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          destination_icao?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      custom_sidebar_links: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          url: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          url?: string
        }
        Relationships: []
      }
      daily_featured_routes: {
        Row: {
          created_at: string
          featured_date: string
          id: string
          route_id: string
        }
        Insert: {
          created_at?: string
          featured_date: string
          id?: string
          route_id: string
        }
        Update: {
          created_at?: string
          featured_date?: string
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_featured_routes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          assigned_arr_gate: string | null
          assigned_dep_gate: string | null
          event_id: string
          id: string
          pilot_id: string
          registered_at: string | null
        }
        Insert: {
          assigned_arr_gate?: string | null
          assigned_dep_gate?: string | null
          event_id: string
          id?: string
          pilot_id: string
          registered_at?: string | null
        }
        Update: {
          assigned_arr_gate?: string | null
          assigned_dep_gate?: string | null
          event_id?: string
          id?: string
          pilot_id?: string
          registered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          arr_icao: string
          available_arr_gates: string[] | null
          available_dep_gates: string[] | null
          banner_url: string | null
          created_at: string | null
          dep_icao: string
          description: string | null
          end_time: string
          id: string
          is_active: boolean | null
          name: string
          server: string
          start_time: string
        }
        Insert: {
          arr_icao: string
          available_arr_gates?: string[] | null
          available_dep_gates?: string[] | null
          banner_url?: string | null
          created_at?: string | null
          dep_icao: string
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          name: string
          server: string
          start_time: string
        }
        Update: {
          arr_icao?: string
          available_arr_gates?: string[] | null
          available_dep_gates?: string[] | null
          banner_url?: string | null
          created_at?: string | null
          dep_icao?: string
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          name?: string
          server?: string
          start_time?: string
        }
        Relationships: []
      }
      multiplier_configs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          value?: number
        }
        Relationships: []
      }
      notams: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_applications: {
        Row: {
          assigned_pid: string | null
          created_at: string | null
          email: string
          experience_level: string
          full_name: string
          id: string
          ivao_id: string | null
          preferred_simulator: string
          reason_for_joining: string
          rejection_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          user_id: string
          vatsim_id: string | null
        }
        Insert: {
          assigned_pid?: string | null
          created_at?: string | null
          email: string
          experience_level: string
          full_name: string
          id?: string
          ivao_id?: string | null
          preferred_simulator: string
          reason_for_joining: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          user_id: string
          vatsim_id?: string | null
        }
        Update: {
          assigned_pid?: string | null
          created_at?: string | null
          email?: string
          experience_level?: string
          full_name?: string
          id?: string
          ivao_id?: string | null
          preferred_simulator?: string
          reason_for_joining?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          user_id?: string
          vatsim_id?: string | null
        }
        Relationships: []
      }
      pilot_bonus_cards: {
        Row: {
          card_number: string
          created_at: string
          id: string
          pilot_id: string
        }
        Insert: {
          card_number: string
          created_at?: string
          id?: string
          pilot_id: string
        }
        Update: {
          card_number?: string
          created_at?: string
          id?: string
          pilot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_bonus_cards_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: true
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_pirep_date: string | null
          longest_streak: number | null
          pilot_id: string
          updated_at: string | null
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_pirep_date?: string | null
          longest_streak?: number | null
          pilot_id: string
          updated_at?: string | null
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_pirep_date?: string | null
          longest_streak?: number | null
          pilot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_streaks_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: true
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      pilots: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_rank: string | null
          full_name: string
          id: string
          ivao_id: string | null
          pid: string
          total_hours: number | null
          total_pireps: number | null
          updated_at: string | null
          user_id: string
          vatsim_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_rank?: string | null
          full_name: string
          id?: string
          ivao_id?: string | null
          pid: string
          total_hours?: number | null
          total_pireps?: number | null
          updated_at?: string | null
          user_id: string
          vatsim_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_rank?: string | null
          full_name?: string
          id?: string
          ivao_id?: string | null
          pid?: string
          total_hours?: number | null
          total_pireps?: number | null
          updated_at?: string | null
          user_id?: string
          vatsim_id?: string | null
        }
        Relationships: []
      }
      pireps: {
        Row: {
          aircraft_icao: string
          arr_icao: string
          created_at: string | null
          dep_icao: string
          flight_date: string
          flight_hours: number
          flight_number: string
          flight_type: Database["public"]["Enums"]["flight_type"]
          id: string
          multiplier: number | null
          operator: string
          pilot_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["pirep_status"] | null
          status_reason: string | null
        }
        Insert: {
          aircraft_icao: string
          arr_icao: string
          created_at?: string | null
          dep_icao: string
          flight_date: string
          flight_hours: number
          flight_number: string
          flight_type: Database["public"]["Enums"]["flight_type"]
          id?: string
          multiplier?: number | null
          operator: string
          pilot_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pirep_status"] | null
          status_reason?: string | null
        }
        Update: {
          aircraft_icao?: string
          arr_icao?: string
          created_at?: string | null
          dep_icao?: string
          flight_date?: string
          flight_hours?: number
          flight_number?: string
          flight_type?: Database["public"]["Enums"]["flight_type"]
          id?: string
          multiplier?: number | null
          operator?: string
          pilot_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pirep_status"] | null
          status_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pireps_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_configs: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label: string
          max_hours: number | null
          min_hours: number
          name: string
          order_index: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          max_hours?: number | null
          min_hours?: number
          name: string
          order_index?: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          max_hours?: number | null
          min_hours?: number
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      routes: {
        Row: {
          aircraft_icao: string | null
          arr_icao: string
          created_at: string | null
          dep_icao: string
          est_flight_time_minutes: number
          id: string
          is_active: boolean | null
          livery: string | null
          min_rank: string | null
          notes: string | null
          route_number: string
          route_type: Database["public"]["Enums"]["flight_type"]
        }
        Insert: {
          aircraft_icao?: string | null
          arr_icao: string
          created_at?: string | null
          dep_icao: string
          est_flight_time_minutes: number
          id?: string
          is_active?: boolean | null
          livery?: string | null
          min_rank?: string | null
          notes?: string | null
          route_number: string
          route_type: Database["public"]["Enums"]["flight_type"]
        }
        Update: {
          aircraft_icao?: string | null
          arr_icao?: string
          created_at?: string | null
          dep_icao?: string
          est_flight_time_minutes?: number
          id?: string
          is_active?: boolean | null
          livery?: string | null
          min_rank?: string | null
          notes?: string | null
          route_number?: string
          route_type?: Database["public"]["Enums"]["flight_type"]
        }
        Relationships: []
      }
      routes_of_week: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          route_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          route_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          route_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_of_week_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_of_week_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_rank: { Args: { hours: number }; Returns: string }
      check_and_assign_admin_role: {
        Args: { user_email: string; user_id_param: string }
        Returns: boolean
      }
      get_next_pid: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pilot"
      application_status: "pending" | "approved" | "rejected"
      flight_type: "passenger" | "cargo"
      pilot_rank:
        | "cadet"
        | "first_officer"
        | "captain"
        | "senior_captain"
        | "commander"
      pirep_status: "pending" | "approved" | "denied" | "on_hold"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pilot"],
      application_status: ["pending", "approved", "rejected"],
      flight_type: ["passenger", "cargo"],
      pilot_rank: [
        "cadet",
        "first_officer",
        "captain",
        "senior_captain",
        "commander",
      ],
      pirep_status: ["pending", "approved", "denied", "on_hold"],
    },
  },
} as const
