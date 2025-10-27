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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_tokens: {
        Row: {
          created_at: string | null
          encrypted_token: string
          expires_at: string | null
          id: string
          token_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_token: string
          expires_at?: string | null
          id?: string
          token_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_token?: string
          expires_at?: string | null
          id?: string
          token_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      carrier_folders: {
        Row: {
          body_keywords: string[]
          carrier_name: string
          color: string | null
          created_at: string | null
          display_name: string
          email_addresses: string[]
          email_domains: string[]
          icon: string | null
          id: string
          is_active: boolean | null
          keywords: string[]
          updated_at: string | null
        }
        Insert: {
          body_keywords?: string[]
          carrier_name: string
          color?: string | null
          created_at?: string | null
          display_name: string
          email_addresses?: string[]
          email_domains?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[]
          updated_at?: string | null
        }
        Update: {
          body_keywords?: string[]
          carrier_name?: string
          color?: string | null
          created_at?: string | null
          display_name?: string
          email_addresses?: string[]
          email_domains?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      email_actions: {
        Row: {
          action_code: string | null
          action_status: string | null
          analysis_id: string
          assigned_to: string | null
          carrier: string
          carrier_label: string
          category: string | null
          created_at: string
          customer_name: string
          due_date: string | null
          email_id: string
          email_received_date: string
          email_subject: string
          email_update_date: string | null
          external_reference: string | null
          ghl_note: string | null
          ghl_stage_change: string | null
          id: string
          is_processed: boolean | null
          notes: string | null
          policy_id: string | null
          priority: string | null
          processed_at: string | null
          processed_by: string | null
          subcategory: string | null
          suggested_action: string | null
          summary: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          action_code?: string | null
          action_status?: string | null
          analysis_id: string
          assigned_to?: string | null
          carrier: string
          carrier_label: string
          category?: string | null
          created_at?: string
          customer_name: string
          due_date?: string | null
          email_id: string
          email_received_date: string
          email_subject: string
          email_update_date?: string | null
          external_reference?: string | null
          ghl_note?: string | null
          ghl_stage_change?: string | null
          id?: string
          is_processed?: boolean | null
          notes?: string | null
          policy_id?: string | null
          priority?: string | null
          processed_at?: string | null
          processed_by?: string | null
          subcategory?: string | null
          suggested_action?: string | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          action_code?: string | null
          action_status?: string | null
          analysis_id?: string
          assigned_to?: string | null
          carrier?: string
          carrier_label?: string
          category?: string | null
          created_at?: string
          customer_name?: string
          due_date?: string | null
          email_id?: string
          email_received_date?: string
          email_subject?: string
          email_update_date?: string | null
          external_reference?: string | null
          ghl_note?: string | null
          ghl_stage_change?: string | null
          id?: string
          is_processed?: boolean | null
          notes?: string | null
          policy_id?: string | null
          priority?: string | null
          processed_at?: string | null
          processed_by?: string | null
          subcategory?: string | null
          suggested_action?: string | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_actions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "email_analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_actions_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_analysis_results: {
        Row: {
          action_code: string | null
          analysis_timestamp: string
          carrier: string | null
          category: string | null
          created_at: string
          customer_name: string | null
          document_links: Json | null
          email_id: string
          email_update_date: string | null
          ghl_note: string | null
          ghl_stage: string | null
          id: string
          is_reviewed: boolean | null
          pdf_analysis: Json | null
          policy_id: string | null
          reason: string | null
          review_status: string | null
          subcategory: string | null
          suggested_action: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          action_code?: string | null
          analysis_timestamp?: string
          carrier?: string | null
          category?: string | null
          created_at?: string
          customer_name?: string | null
          document_links?: Json | null
          email_id: string
          email_update_date?: string | null
          ghl_note?: string | null
          ghl_stage?: string | null
          id?: string
          is_reviewed?: boolean | null
          pdf_analysis?: Json | null
          policy_id?: string | null
          reason?: string | null
          review_status?: string | null
          subcategory?: string | null
          suggested_action?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          action_code?: string | null
          analysis_timestamp?: string
          carrier?: string | null
          category?: string | null
          created_at?: string
          customer_name?: string | null
          document_links?: Json | null
          email_id?: string
          email_update_date?: string | null
          ghl_note?: string | null
          ghl_stage?: string | null
          id?: string
          is_reviewed?: boolean | null
          pdf_analysis?: Json | null
          policy_id?: string | null
          reason?: string | null
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
            isOneToOne: true
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
          folder_id: string | null
          from_email: string | null
          gmail_id: string
          gmail_url: string | null
          id: string
          pdf_attachments: Json | null
          pdf_extracted_content: string | null
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
          folder_id?: string | null
          from_email?: string | null
          gmail_id: string
          gmail_url?: string | null
          id?: string
          pdf_attachments?: Json | null
          pdf_extracted_content?: string | null
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
          folder_id?: string | null
          from_email?: string | null
          gmail_id?: string
          gmail_url?: string | null
          id?: string
          pdf_attachments?: Json | null
          pdf_extracted_content?: string | null
          received_date?: string
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "carrier_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gtl_scraped_policies: {
        Row: {
          age: string | null
          agent_name: string | null
          agent_number: string | null
          applicant_name: string | null
          application_date: string | null
          created_at: string | null
          dob: string | null
          face_amount: string | null
          gender: string | null
          id: string
          issue_date: string | null
          job_id: string
          notes: string | null
          plan_code: string | null
          plan_name: string | null
          policy_number: string
          premium: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          updated_date: string | null
        }
        Insert: {
          age?: string | null
          agent_name?: string | null
          agent_number?: string | null
          applicant_name?: string | null
          application_date?: string | null
          created_at?: string | null
          dob?: string | null
          face_amount?: string | null
          gender?: string | null
          id?: string
          issue_date?: string | null
          job_id: string
          notes?: string | null
          plan_code?: string | null
          plan_name?: string | null
          policy_number: string
          premium?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          updated_date?: string | null
        }
        Update: {
          age?: string | null
          agent_name?: string | null
          agent_number?: string | null
          applicant_name?: string | null
          application_date?: string | null
          created_at?: string | null
          dob?: string | null
          face_amount?: string | null
          gender?: string | null
          id?: string
          issue_date?: string | null
          job_id?: string
          notes?: string | null
          plan_code?: string | null
          plan_name?: string | null
          policy_number?: string
          premium?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gtl_scraped_policies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      gtl_scraper_sessions: {
        Row: {
          browser_url: string | null
          created_at: string | null
          current_page: number | null
          error_message: string | null
          gologin_profile_id: string | null
          id: string
          job_id: string | null
          scraped_count: number | null
          status: string
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          browser_url?: string | null
          created_at?: string | null
          current_page?: number | null
          error_message?: string | null
          gologin_profile_id?: string | null
          id?: string
          job_id?: string | null
          scraped_count?: number | null
          status?: string
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          browser_url?: string | null
          created_at?: string | null
          current_page?: number | null
          error_message?: string | null
          gologin_profile_id?: string | null
          id?: string
          job_id?: string | null
          scraped_count?: number | null
          status?: string
          total_pages?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gtl_scraper_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          end_time: string | null
          error_message: string | null
          id: number
          metrics: Json | null
          pipeline_type: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          error_message?: string | null
          id?: number
          metrics?: Json | null
          pipeline_type: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          error_message?: string | null
          id?: number
          metrics?: Json | null
          pipeline_type?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scraped_policies: {
        Row: {
          age: number | null
          agent_name: string | null
          agent_number: string | null
          applicant_name: string | null
          application_date: string | null
          carrier_name: string
          coverage_amount: string | null
          created_at: string | null
          date_of_birth: string | null
          gender: string | null
          id: string
          issue_date: string | null
          job_id: string
          last_updated: string | null
          notes: string | null
          plan_code: string | null
          plan_name: string | null
          policy_number: string
          premium: number | null
          raw_data: Json | null
          state: string | null
          status: string | null
        }
        Insert: {
          age?: number | null
          agent_name?: string | null
          agent_number?: string | null
          applicant_name?: string | null
          application_date?: string | null
          carrier_name: string
          coverage_amount?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          issue_date?: string | null
          job_id: string
          last_updated?: string | null
          notes?: string | null
          plan_code?: string | null
          plan_name?: string | null
          policy_number: string
          premium?: number | null
          raw_data: Json | null
          state?: string | null
          status?: string | null
        }
        Update: {
          age?: number | null
          agent_name?: string | null
          agent_number?: string | null
          applicant_name?: string | null
          application_date?: string | null
          carrier_name?: string
          coverage_amount?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          issue_date?: string | null
          job_id?: string
          last_updated?: string | null
          notes?: string | null
          plan_code?: string | null
          plan_name?: string | null
          policy_number?: string
          premium?: number | null
          raw_data?: Json | null
          state?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_policies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_jobs: {
        Row: {
          carrier_name: string
          completed_at: string | null
          config: Json
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          job_name: string
          progress: number | null
          scraped_records: number | null
          started_at: string | null
          status: string
          total_records: number | null
          updated_at: string | null
        }
        Insert: {
          carrier_name?: string
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_name: string
          progress?: number | null
          scraped_records?: number | null
          started_at?: string | null
          status?: string
          total_records?: number | null
          updated_at?: string | null
        }
        Update: {
          carrier_name?: string
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_name?: string
          progress?: number | null
          scraped_records?: number | null
          started_at?: string | null
          status?: string
          total_records?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
