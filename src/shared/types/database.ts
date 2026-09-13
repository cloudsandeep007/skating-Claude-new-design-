export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan_tier: Database['public']['Enums']['plan_tier']
          settings: Json
          slug: string
          status: Database['public']['Enums']['academy_status']
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan_tier?: Database['public']['Enums']['plan_tier']
          settings?: Json
          slug: string
          status?: Database['public']['Enums']['academy_status']
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan_tier?: Database['public']['Enums']['plan_tier']
          settings?: Json
          slug?: string
          status?: Database['public']['Enums']['academy_status']
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          academy_id: string
          audience: Database['public']['Enums']['announcement_audience']
          batch_id: string | null
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          audience?: Database['public']['Enums']['announcement_audience']
          batch_id?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          audience?: Database['public']['Enums']['announcement_audience']
          batch_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'announcements_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'announcements_batch_id_academy_id_fkey'
            columns: ['batch_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'batches'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'announcements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attendance: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          marked_at: string
          marked_by: string | null
          notes: string | null
          session_id: string
          status: Database['public']['Enums']['attendance_status']
          student_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id: string
          status: Database['public']['Enums']['attendance_status']
          student_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id?: string
          status?: Database['public']['Enums']['attendance_status']
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_marked_by_fkey'
            columns: ['marked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_session_id_academy_id_fkey'
            columns: ['session_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'schedule_sessions'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'attendance_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      audit_logs: {
        Row: {
          academy_id: string | null
          action: string
          actor_profile_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
        }
        Insert: {
          academy_id?: string | null
          action: string
          actor_profile_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
        }
        Update: {
          academy_id?: string | null
          action?: string
          actor_profile_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_actor_profile_id_fkey'
            columns: ['actor_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      batches: {
        Row: {
          academy_id: string
          capacity: number
          coach_id: string | null
          created_at: string
          days_of_week: number[]
          end_time: string
          id: string
          level_range: string | null
          name: string
          start_time: string
          status: Database['public']['Enums']['batch_status']
          updated_at: string
          venue: string | null
        }
        Insert: {
          academy_id: string
          capacity?: number
          coach_id?: string | null
          created_at?: string
          days_of_week?: number[]
          end_time: string
          id?: string
          level_range?: string | null
          name: string
          start_time: string
          status?: Database['public']['Enums']['batch_status']
          updated_at?: string
          venue?: string | null
        }
        Update: {
          academy_id?: string
          capacity?: number
          coach_id?: string | null
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          level_range?: string | null
          name?: string
          start_time?: string
          status?: Database['public']['Enums']['batch_status']
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'batches_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'batches_coach_id_academy_id_fkey'
            columns: ['coach_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'coaches'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      coaches: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          joined_date: string
          profile_id: string
          specialization: string | null
          status: Database['public']['Enums']['coach_status']
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          joined_date?: string
          profile_id: string
          specialization?: string | null
          status?: Database['public']['Enums']['coach_status']
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          joined_date?: string
          profile_id?: string
          specialization?: string | null
          status?: Database['public']['Enums']['coach_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coaches_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coaches_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      error_logs: {
        Row: {
          academy_id: string | null
          created_at: string
          id: string
          level: Database['public']['Enums']['error_level']
          message: string
          profile_id: string | null
          route: string | null
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          academy_id?: string | null
          created_at?: string
          id?: string
          level?: Database['public']['Enums']['error_level']
          message: string
          profile_id?: string | null
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          academy_id?: string | null
          created_at?: string
          id?: string
          level?: Database['public']['Enums']['error_level']
          message?: string
          profile_id?: string | null
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'error_logs_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'error_logs_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      feature_flags: {
        Row: {
          academy_overrides: Json
          created_at: string
          description: string | null
          enabled_globally: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          academy_overrides?: Json
          created_at?: string
          description?: string | null
          enabled_globally?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          academy_overrides?: Json
          created_at?: string
          description?: string | null
          enabled_globally?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_plans: {
        Row: {
          academy_id: string
          amount: number
          billing_cycle: Database['public']['Enums']['billing_cycle']
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          amount: number
          billing_cycle: Database['public']['Enums']['billing_cycle']
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          amount?: number
          billing_cycle?: Database['public']['Enums']['billing_cycle']
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fee_plans_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
        ]
      }
      levels: {
        Row: {
          academy_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          sequence: number
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sequence: number
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'levels_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          academy_id: string
          body: string | null
          created_at: string
          id: string
          link: string | null
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          academy_id: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          academy_id?: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      parents_students: {
        Row: {
          academy_id: string
          created_at: string
          parent_profile_id: string
          relationship: Database['public']['Enums']['parent_relationship']
          student_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          parent_profile_id: string
          relationship?: Database['public']['Enums']['parent_relationship']
          student_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          parent_profile_id?: string
          relationship?: Database['public']['Enums']['parent_relationship']
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'parents_students_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parents_students_parent_profile_id_fkey'
            columns: ['parent_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parents_students_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      payments: {
        Row: {
          academy_id: string
          amount: number
          created_at: string
          id: string
          method: Database['public']['Enums']['payment_method']
          notes: string | null
          paid_date: string
          recorded_by: string | null
          reference: string | null
          student_fee_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          amount: number
          created_at?: string
          id?: string
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          paid_date?: string
          recorded_by?: string | null
          reference?: string | null
          student_fee_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          amount?: number
          created_at?: string
          id?: string
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          paid_date?: string
          recorded_by?: string | null
          reference?: string | null
          student_fee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_student_fee_id_academy_id_fkey'
            columns: ['student_fee_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'student_fees'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      profiles: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database['public']['Enums']['app_role']
          status: Database['public']['Enums']['profile_status']
          updated_at: string
        }
        Insert: {
          academy_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          role: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['profile_status']
          updated_at?: string
        }
        Update: {
          academy_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['profile_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_sessions: {
        Row: {
          academy_id: string
          batch_id: string
          cancellation_reason: string | null
          coach_id: string | null
          created_at: string
          end_time: string
          id: string
          session_date: string
          start_time: string
          status: Database['public']['Enums']['session_status']
          updated_at: string
        }
        Insert: {
          academy_id: string
          batch_id: string
          cancellation_reason?: string | null
          coach_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          session_date: string
          start_time: string
          status?: Database['public']['Enums']['session_status']
          updated_at?: string
        }
        Update: {
          academy_id?: string
          batch_id?: string
          cancellation_reason?: string | null
          coach_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          session_date?: string
          start_time?: string
          status?: Database['public']['Enums']['session_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_sessions_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_sessions_batch_id_academy_id_fkey'
            columns: ['batch_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'batches'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'schedule_sessions_coach_id_academy_id_fkey'
            columns: ['coach_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'coaches'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      skills: {
        Row: {
          academy_id: string
          created_at: string
          description: string | null
          id: string
          level_id: string
          name: string
          sequence: number
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          description?: string | null
          id?: string
          level_id: string
          name: string
          sequence: number
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          description?: string | null
          id?: string
          level_id?: string
          name?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'skills_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'skills_level_id_academy_id_fkey'
            columns: ['level_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'levels'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      student_batches: {
        Row: {
          academy_id: string
          batch_id: string
          created_at: string
          enrolled_date: string
          status: Database['public']['Enums']['enrollment_status']
          student_id: string
        }
        Insert: {
          academy_id: string
          batch_id: string
          created_at?: string
          enrolled_date?: string
          status?: Database['public']['Enums']['enrollment_status']
          student_id: string
        }
        Update: {
          academy_id?: string
          batch_id?: string
          created_at?: string
          enrolled_date?: string
          status?: Database['public']['Enums']['enrollment_status']
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_batches_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_batches_batch_id_academy_id_fkey'
            columns: ['batch_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'batches'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'student_batches_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      student_fees: {
        Row: {
          academy_id: string
          amount: number
          created_at: string
          due_date: string
          fee_plan_id: string | null
          id: string
          period_end: string
          period_start: string
          status: Database['public']['Enums']['fee_status']
          student_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          amount: number
          created_at?: string
          due_date: string
          fee_plan_id?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: Database['public']['Enums']['fee_status']
          student_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          fee_plan_id?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: Database['public']['Enums']['fee_status']
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_fees_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_fees_fee_plan_id_academy_id_fkey'
            columns: ['fee_plan_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'fee_plans'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'student_fees_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      student_skills: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          notes: string | null
          skill_id: string
          status: Database['public']['Enums']['skill_status']
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          notes?: string | null
          skill_id: string
          status?: Database['public']['Enums']['skill_status']
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          skill_id?: string
          status?: Database['public']['Enums']['skill_status']
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_skills_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_skills_skill_id_academy_id_fkey'
            columns: ['skill_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'skills'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'student_skills_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
          {
            foreignKeyName: 'student_skills_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      students: {
        Row: {
          academy_id: string
          created_at: string
          current_level_id: string | null
          date_of_birth: string | null
          emergency_contact: Json
          full_name: string
          gender: Database['public']['Enums']['gender'] | null
          id: string
          joined_date: string
          medical_notes: string | null
          photo_url: string | null
          status: Database['public']['Enums']['student_status']
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          current_level_id?: string | null
          date_of_birth?: string | null
          emergency_contact?: Json
          full_name: string
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          joined_date?: string
          medical_notes?: string | null
          photo_url?: string | null
          status?: Database['public']['Enums']['student_status']
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          current_level_id?: string | null
          date_of_birth?: string | null
          emergency_contact?: Json
          full_name?: string
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          joined_date?: string
          medical_notes?: string | null
          photo_url?: string | null
          status?: Database['public']['Enums']['student_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'students_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_current_level_id_academy_id_fkey'
            columns: ['current_level_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'levels'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
    }
    Views: {
      at_risk_students: {
        Row: {
          academy_id: string | null
          attendance_pct: number | null
          attended_sessions: number | null
          batch_names: string | null
          counted_sessions: number | null
          full_name: string | null
          parent_name: string | null
          parent_phone: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
      batch_attendance_summary: {
        Row: {
          academy_id: string | null
          attendance_pct: number | null
          attended_sessions: number | null
          batch_id: string | null
          batch_name: string | null
          batch_status: Database['public']['Enums']['batch_status'] | null
          counted_sessions: number | null
          sessions_marked: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_collection_totals: {
        Row: {
          academy_id: string | null
          collected: number | null
          expected: number | null
          month: string | null
          outstanding: number | null
          overdue_count: number | null
          paid_count: number | null
          payment_count: number | null
          pending_count: number | null
          waived_count: number | null
        }
        Relationships: []
      }
      student_attendance_summary: {
        Row: {
          absent_sessions: number | null
          academy_id: string | null
          attendance_pct: number | null
          attended_sessions: number | null
          counted_sessions: number | null
          excused_sessions: number | null
          full_name: string | null
          late_sessions: number | null
          student_id: string | null
          student_status: Database['public']['Enums']['student_status'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_academy_id_fkey'
            columns: ['academy_id']
            isOneToOne: false
            referencedRelation: 'academies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_student_id_academy_id_fkey'
            columns: ['student_id', 'academy_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id', 'academy_id']
          },
        ]
      }
    }
    Functions: {
      at_risk_students_for: {
        Args: { p_days?: number; p_min_sessions?: number; p_threshold?: number }
        Returns: {
          attendance_pct: number
          attended_sessions: number
          counted_sessions: number
          full_name: string
          student_id: string
        }[]
      }
      attendance_summary_for_range: {
        Args: { p_batch_id?: string; p_from: string; p_to: string }
        Returns: {
          absent_sessions: number
          attendance_pct: number
          attended_sessions: number
          counted_sessions: number
          excused_sessions: number
          full_name: string
          late_sessions: number
          student_id: string
        }[]
      }
      current_academy_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database['public']['Enums']['app_role']
      }
      is_academy_admin: { Args: never; Returns: boolean }
      is_coach: { Args: never; Returns: boolean }
      is_parent: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      parent_batch_ids: { Args: never; Returns: string[] }
      parent_student_ids: { Args: never; Returns: string[] }
      request_ip: { Args: never; Returns: unknown }
    }
    Enums: {
      academy_status: 'active' | 'suspended' | 'archived'
      announcement_audience: 'all' | 'batch' | 'parents' | 'coaches'
      app_role: 'super_admin' | 'academy_admin' | 'coach' | 'parent'
      attendance_status: 'present' | 'absent' | 'late' | 'excused'
      batch_status: 'active' | 'inactive' | 'archived'
      billing_cycle: 'monthly' | 'quarterly' | 'annual'
      coach_status: 'active' | 'inactive'
      enrollment_status: 'active' | 'inactive'
      error_level: 'debug' | 'info' | 'warning' | 'error' | 'fatal'
      fee_status: 'pending' | 'paid' | 'overdue' | 'waived'
      gender: 'male' | 'female' | 'other'
      parent_relationship: 'father' | 'mother' | 'guardian' | 'other'
      payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other'
      plan_tier: 'free' | 'starter' | 'pro'
      profile_status: 'active' | 'invited' | 'inactive'
      session_status: 'scheduled' | 'completed' | 'cancelled'
      skill_status: 'not_started' | 'learning' | 'achieved'
      student_status: 'active' | 'inactive' | 'archived'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      academy_status: ['active', 'suspended', 'archived'],
      announcement_audience: ['all', 'batch', 'parents', 'coaches'],
      app_role: ['super_admin', 'academy_admin', 'coach', 'parent'],
      attendance_status: ['present', 'absent', 'late', 'excused'],
      batch_status: ['active', 'inactive', 'archived'],
      billing_cycle: ['monthly', 'quarterly', 'annual'],
      coach_status: ['active', 'inactive'],
      enrollment_status: ['active', 'inactive'],
      error_level: ['debug', 'info', 'warning', 'error', 'fatal'],
      fee_status: ['pending', 'paid', 'overdue', 'waived'],
      gender: ['male', 'female', 'other'],
      parent_relationship: ['father', 'mother', 'guardian', 'other'],
      payment_method: ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other'],
      plan_tier: ['free', 'starter', 'pro'],
      profile_status: ['active', 'invited', 'inactive'],
      session_status: ['scheduled', 'completed', 'cancelled'],
      skill_status: ['not_started', 'learning', 'achieved'],
      student_status: ['active', 'inactive', 'archived'],
    },
  },
} as const
