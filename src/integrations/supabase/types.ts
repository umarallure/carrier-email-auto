export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      email_analysis_results: {
        Row: {
          analysis_timestamp: string
          category: string | null
          created_at: string
          customer_name: string | null
          email_id: string
          email_update_date: string | null
          id: string
          is_reviewed: boolean | null
          policy_id: string | null
          review_status: string | null
          subcategory: string | null
          suggested_action: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          analysis_timestamp?: string
          category?: string | null
          created_at?: string
          customer_name?: string | null
          email_id: string
          email_update_date?: string | null
          id?: string
          is_reviewed?: boolean | null
          policy_id?: string | null
          review_status?: string | null
          subcategory?: string | null
          suggested_action?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          analysis_timestamp?: string
          category?: string | null
          created_at?: string
          customer_name?: string | null
          email_id?: string
          email_update_date?: string | null
          id?: string
          is_reviewed?: boolean | null
          policy_id?: string | null
          review_status?: string | null
          subcategory?: string | null
          suggested_action?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_analysis_results_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          attachments: string[] | null
          body: string | null
          carrier: string
          carrier_label: string
          created_at: string
          gmail_id: string
          id: string
          received_date: string
          status: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[] | null
          body?: string | null
          carrier: string
          carrier_label: string
          created_at?: string
          gmail_id: string
          id?: string
          received_date: string
          status?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[] | null
          body?: string | null
          carrier?: string
          carrier_label?: string
          created_at?: string
          gmail_id?: string
          id?: string
          received_date?: string
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_actions: {
        Row: {
          id: string
          email_id: string
          analysis_id: string
          customer_name: string
          policy_id: string | null
          email_subject: string
          email_received_date: string
          carrier: string
          carrier_label: string
          email_update_date: string | null
          summary: string | null
          suggested_action: string | null
          category: string | null
          subcategory: string | null
          action_code: string | null
          ghl_note: string | null
          ghl_stage_change: string | null
          action_status: string | null
          priority: string | null
          assigned_to: string | null
          due_date: string | null
          is_processed: boolean | null
          processed_at: string | null
          processed_by: string | null
          notes: string | null
          external_reference: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email_id: string
          analysis_id: string
          customer_name: string
          policy_id?: string | null
          email_subject: string
          email_received_date: string
          carrier: string
          carrier_label: string
          email_update_date?: string | null
          summary?: string | null
          suggested_action?: string | null
          category?: string | null
          subcategory?: string | null
          action_code?: string | null
          ghl_note?: string | null
          ghl_stage_change?: string | null
          action_status?: string | null
          priority?: string | null
          assigned_to?: string | null
          due_date?: string | null
          is_processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          notes?: string | null
          external_reference?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email_id?: string
          analysis_id?: string
          customer_name?: string
          policy_id?: string | null
          email_subject?: string
          email_received_date?: string
          carrier?: string
          carrier_label?: string
          email_update_date?: string | null
          summary?: string | null
          suggested_action?: string | null
          category?: string | null
          subcategory?: string | null
          action_code?: string | null
          ghl_note?: string | null
          ghl_stage_change?: string | null
          action_status?: string | null
          priority?: string | null
          assigned_to?: string | null
          due_date?: string | null
          is_processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          notes?: string | null
          external_reference?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_actions_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_actions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "email_analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
