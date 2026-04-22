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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          contact: string | null
          created_at: string
          email: string | null
          gps_code: string | null
          id: string
          name: string
          ownership_type: Database["public"]["Enums"]["ownership_type"] | null
          region: string | null
          type: Database["public"]["Enums"]["clinic_type"]
          unique_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          gps_code?: string | null
          id?: string
          name: string
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null
          region?: string | null
          type?: Database["public"]["Enums"]["clinic_type"]
          unique_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          gps_code?: string | null
          id?: string
          name?: string
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null
          region?: string | null
          type?: Database["public"]["Enums"]["clinic_type"]
          unique_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          hospital_id: string
          id: string
          phone: string | null
          specialty: string | null
          status: string
          unique_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          hospital_id: string
          id?: string
          phone?: string | null
          specialty?: string | null
          status?: string
          unique_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          hospital_id?: string
          id?: string
          phone?: string | null
          specialty?: string | null
          status?: string
          unique_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string | null
          contact: string | null
          created_at: string
          departments: string[] | null
          email: string | null
          gps_code: string | null
          id: string
          name: string
          region: string | null
          type: Database["public"]["Enums"]["hospital_type"]
          unique_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          departments?: string[] | null
          email?: string | null
          gps_code?: string | null
          id?: string
          name: string
          region?: string | null
          type?: Database["public"]["Enums"]["hospital_type"]
          unique_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          departments?: string[] | null
          email?: string | null
          gps_code?: string | null
          id?: string
          name?: string
          region?: string | null
          type?: Database["public"]["Enums"]["hospital_type"]
          unique_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          age: number | null
          clinic_id: string
          created_at: string
          created_by: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clinic_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          hospital_id: string | null
          id: string
          phone: string | null
          status: string
          unique_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hospital_id?: string | null
          id: string
          phone?: string | null
          status?: string
          unique_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hospital_id?: string | null
          id?: string
          phone?: string | null
          status?: string
          unique_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          referral_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          referral_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          referral_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_attachments_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          referral_id: string
          sender_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          referral_id: string
          sender_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          referral_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_messages_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["referral_status"] | null
          id: string
          note: string | null
          referral_id: string
          to_status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["referral_status"] | null
          id?: string
          note?: string | null
          referral_id: string
          to_status: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["referral_status"] | null
          id?: string
          note?: string | null
          referral_id?: string
          to_status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referral_status_history_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          assigned_department: string | null
          assigned_doctor_id: string | null
          clinic_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          department_id: string | null
          hospital_feedback: string | null
          hospital_id: string | null
          id: string
          notes: string | null
          patient_age: number | null
          patient_gender: Database["public"]["Enums"]["gender_type"] | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          referral_number: string | null
          referral_reason: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["referral_status"]
          symptoms: string | null
          vitals_bp: string | null
          vitals_hr: string | null
          vitals_rr: string | null
          vitals_spo2: string | null
          vitals_temp: string | null
          unique_id: string | null
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          assigned_department?: string | null
          assigned_doctor_id?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          department_id?: string | null
          hospital_feedback?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string | null
          patient_age?: number | null
          patient_gender?: Database["public"]["Enums"]["gender_type"] | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          referral_number?: string | null
          referral_reason?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          symptoms?: string | null
          vitals_bp?: string | null
          vitals_hr?: string | null
          vitals_rr?: string | null
          vitals_spo2?: string | null
          vitals_temp?: string | null
          unique_id?: string | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          assigned_department?: string | null
          assigned_doctor_id?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          department_id?: string | null
          hospital_feedback?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string | null
          patient_age?: number | null
          patient_gender?: Database["public"]["Enums"]["gender_type"] | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          referral_number?: string | null
          referral_reason?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          symptoms?: string | null
          vitals_bp?: string | null
          vitals_hr?: string | null
          vitals_rr?: string | null
          vitals_spo2?: string | null
          vitals_temp?: string | null
          unique_id?: string | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_clinic_id: { Args: never; Returns: string }
      current_hospital_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_login_identifier: {
        Args: {
          p_identifier: string
        }
        Returns: string | null
      }
      upsert_patient_for_clinic: {
        Args: {
          p_clinic_id: string
          p_full_name: string
          p_age?: number | null
          p_gender?: Database["public"]["Enums"]["gender_type"] | null
          p_phone?: string | null
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "hospital_admin"
        | "hospital_staff"
        | "clinic_user"
        | "doctor"
      clinic_type:
        | "CHPS"
        | "Polyclinic"
        | "Private Clinic"
        | "Health Center"
        | "Other"
      gender_type: "male" | "female" | "other"
      hospital_type:
        | "District"
        | "Regional"
        | "Teaching"
        | "Military"
        | "Private"
        | "Other"
      ownership_type: "Private" | "Government" | "Mission" | "Other"
      referral_status:
        | "draft"
        | "submitted"
        | "new"
        | "under_review"
        | "info_requested"
        | "accepted"
        | "rejected"
        | "assigned"
        | "treated"
        | "completed"
      urgency_level: "low" | "medium" | "high" | "critical"
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
      app_role: [
        "admin",
        "hospital_admin",
        "hospital_staff",
        "clinic_user",
        "doctor",
      ],
      clinic_type: [
        "CHPS",
        "Polyclinic",
        "Private Clinic",
        "Health Center",
        "Other",
      ],
      gender_type: ["male", "female", "other"],
      hospital_type: [
        "District",
        "Regional",
        "Teaching",
        "Military",
        "Private",
        "Other",
      ],
      ownership_type: ["Private", "Government", "Mission", "Other"],
      referral_status: [
        "draft",
        "submitted",
        "new",
        "under_review",
        "info_requested",
        "accepted",
        "rejected",
        "assigned",
        "treated",
        "completed",
      ],
      urgency_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
