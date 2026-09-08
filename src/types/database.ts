// Tipos do banco. Nao edite a mao.
//
// A secao Tables foi gerada a partir do schema real do projeto Supabase, e
// confere coluna por coluna com ele.
//
// Para regerar depois de uma migration nova: `npm run types:gen`, que exige
// `supabase login` e `supabase link` (e Docker, porque o CLI roda o
// postgres-meta em container).

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
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          tenant_id: string | null
          role: string | null
          event_type: string | null
          action: string
          category: string | null
          resource_type: string
          resource_id: string | null
          severity: string | null
          status: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          tenant_id?: string | null
          role?: string | null
          event_type?: string | null
          action: string
          category?: string | null
          resource_type: string
          resource_id?: string | null
          severity?: string | null
          status?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          tenant_id?: string | null
          role?: string | null
          event_type?: string | null
          action?: string
          category?: string | null
          resource_type?: string
          resource_id?: string | null
          severity?: string | null
          status?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          id: string
          tenant_id: string
          asaas_payment_id: string
          asaas_subscription_id: string | null
          status: string
          value: number
          due_date: string
          payment_date: string | null
          billing_type: string | null
          invoice_url: string | null
          bank_slip_url: string | null
          pix_qrcode_encoded: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          asaas_payment_id: string
          asaas_subscription_id?: string | null
          status?: string
          value: number
          due_date: string
          payment_date?: string | null
          billing_type?: string | null
          invoice_url?: string | null
          bank_slip_url?: string | null
          pix_qrcode_encoded?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          asaas_payment_id?: string
          asaas_subscription_id?: string | null
          status?: string
          value?: number
          due_date?: string
          payment_date?: string | null
          billing_type?: string | null
          invoice_url?: string | null
          bank_slip_url?: string | null
          pix_qrcode_encoded?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          id: string
          name: string
          category: string
          subcategory: string | null
          tags: string[] | null
          parent_id: string | null
          bot_message: string
          option_label: string | null
          is_root: boolean
          is_terminal: boolean
          escalate_to_human: boolean
          is_published: boolean
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category: string
          subcategory?: string | null
          tags?: string[] | null
          parent_id?: string | null
          bot_message: string
          option_label?: string | null
          is_root?: boolean
          is_terminal?: boolean
          escalate_to_human?: boolean
          is_published?: boolean
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: string
          subcategory?: string | null
          tags?: string[] | null
          parent_id?: string | null
          bot_message?: string
          option_label?: string | null
          is_root?: boolean
          is_terminal?: boolean
          escalate_to_human?: boolean
          is_published?: boolean
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flows_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          id: string
          tenant_id: string
          nome: string
          email: string | null
          telefone: string | null
          foto_url: string | null
          client_user_id: string | null
          portal_activated_at: string | null
          consent_given_at: string | null
          created_at: string
          anonymized_at: string | null
          anonymized_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          nome: string
          email?: string | null
          telefone?: string | null
          foto_url?: string | null
          client_user_id?: string | null
          portal_activated_at?: string | null
          consent_given_at?: string | null
          created_at?: string
          anonymized_at?: string | null
          anonymized_by?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nome?: string
          email?: string | null
          telefone?: string | null
          foto_url?: string | null
          client_user_id?: string | null
          portal_activated_at?: string | null
          consent_given_at?: string | null
          created_at?: string
          anonymized_at?: string | null
          anonymized_by?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_anonymized_by_fkey"
            columns: ["anonymized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_articles: {
        Row: {
          id: string
          title: string
          content: string
          category: string
          subcategory: string | null
          tags: string[] | null
          is_published: boolean
          helpful_yes: number
          helpful_no: number
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          search_vector: unknown | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          category: string
          subcategory?: string | null
          tags?: string[] | null
          is_published?: boolean
          helpful_yes?: number
          helpful_no?: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          search_vector?: unknown | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string
          subcategory?: string | null
          tags?: string[] | null
          is_published?: boolean
          helpful_yes?: number
          helpful_no?: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          search_vector?: unknown | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          tenant_id: string | null
          type: string
          title: string
          message: string
          link: string | null
          read: boolean
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id?: string | null
          type: string
          title: string
          message: string
          link?: string | null
          read?: boolean
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string | null
          type?: string
          title?: string
          message?: string
          link?: string | null
          read?: boolean
          reference_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          nome: string
          preco_mensal: number
          limite_clientes: number
          limite_operacoes_mes: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          preco_mensal: number
          limite_clientes: number
          limite_operacoes_mes: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          preco_mensal?: number
          limite_clientes?: number
          limite_operacoes_mes?: number
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string | null
          client_id: string | null
          nome: string
          email: string
          cargo: string | null
          role: Database["public"]["Enums"]["user_role"]
          created_at: string
          consents_revoked: Json | null
          consents_revoked_at: string | null
          consents_revoked_by: string | null
          anonymized_at: string | null
          anonymized_by: string | null
        }
        Insert: {
          id: string
          tenant_id?: string | null
          client_id?: string | null
          nome: string
          email: string
          cargo?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          consents_revoked?: Json | null
          consents_revoked_at?: string | null
          consents_revoked_by?: string | null
          anonymized_at?: string | null
          anonymized_by?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          client_id?: string | null
          nome?: string
          email?: string
          cargo?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          consents_revoked?: Json | null
          consents_revoked_at?: string | null
          consents_revoked_by?: string | null
          anonymized_at?: string | null
          anonymized_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_anonymized_by_fkey"
            columns: ["anonymized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_consents_revoked_by_fkey"
            columns: ["consents_revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_meta: {
        Row: {
          ticket_id: string
          status: string
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          ticket_id: string
          status?: string
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ticket_id?: string
          status?: string
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_meta_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_meta_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          ticket_number: string
          subject: string
          description: string
          category: string
          subcategory: string | null
          priority: string
          status: Database["public"]["Enums"]["ticket_status"]
          tags: string[] | null
          confidence_score: number | null
          resolution_type: string | null
          blocks_sales: boolean | null
          read: boolean | null
          unread_messages_count: number | null
          created_at: string
          updated_at: string
          lgpd_type: string | null
          lgpd_status: string | null
          lgpd_resolved_at: string | null
          lgpd_processed_by: string | null
          lgpd_resolution_notes: string | null
          lgpd_export_path: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          ticket_number: string
          subject: string
          description: string
          category: string
          subcategory?: string | null
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          confidence_score?: number | null
          resolution_type?: string | null
          blocks_sales?: boolean | null
          read?: boolean | null
          unread_messages_count?: number | null
          created_at?: string
          updated_at?: string
          lgpd_type?: string | null
          lgpd_status?: string | null
          lgpd_resolved_at?: string | null
          lgpd_processed_by?: string | null
          lgpd_resolution_notes?: string | null
          lgpd_export_path?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          ticket_number?: string
          subject?: string
          description?: string
          category?: string
          subcategory?: string | null
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          confidence_score?: number | null
          resolution_type?: string | null
          blocks_sales?: boolean | null
          read?: boolean | null
          unread_messages_count?: number | null
          created_at?: string
          updated_at?: string
          lgpd_type?: string | null
          lgpd_status?: string | null
          lgpd_resolved_at?: string | null
          lgpd_processed_by?: string | null
          lgpd_resolution_notes?: string | null
          lgpd_export_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_lgpd_processed_by_fkey"
            columns: ["lgpd_processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          id: string
          nome_fantasia: string
          razao_social: string | null
          cpf_cnpj: string | null
          segmento: string | null
          telefone: string | null
          whatsapp_atendimento: string | null
          logo_url: string | null
          cep: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          cidade: string | null
          estado: string | null
          plano_id: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome_fantasia: string
          razao_social?: string | null
          cpf_cnpj?: string | null
          segmento?: string | null
          telefone?: string | null
          whatsapp_atendimento?: string | null
          logo_url?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          cidade?: string | null
          estado?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome_fantasia?: string
          razao_social?: string | null
          cpf_cnpj?: string | null
          segmento?: string | null
          telefone?: string | null
          whatsapp_atendimento?: string | null
          logo_url?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          cidade?: string | null
          estado?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          id: string
          ticket_id: string
          message_id: string | null
          uploaded_by: string | null
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          message_id?: string | null
          uploaded_by?: string | null
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          message_id?: string | null
          uploaded_by?: string | null
          file_name?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string | null
          sender_type: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_id?: string | null
          sender_type: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_id?: string | null
          sender_type?: string
          message?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          id: string
          tenant_id: string
          mes_referencia: string
          clientes_cadastrados: number
          operacoes_utilizadas: number
          creditos_extra: number
          creditos_extra_utilizados: number
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          mes_referencia: string
          clientes_cadastrados?: number
          operacoes_utilizadas?: number
          creditos_extra?: number
          creditos_extra_utilizados?: number
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          mes_referencia?: string
          clientes_cadastrados?: number
          operacoes_utilizadas?: number
          creditos_extra?: number
          creditos_extra_utilizados?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      increment_operation_usage: { Args: { p_tenant_id: string }; Returns: number }
      add_operation_credits: { Args: { p_tenant_id: string; p_credits: number }; Returns: undefined }
      get_operation_remaining: {
        Args: { p_tenant_id: string }
        Returns: {
          limite: number
          utilizadas: number
          creditos_extra: number
          creditos_utilizados: number
          restantes: number
        }[]
      }
      is_tenant_admin: { Args: never; Returns: boolean }
      get_my_tenant_id: { Args: never; Returns: string }
      revoke_team_member: { Args: { member_id: string }; Returns: undefined }
      update_team_member: { Args: { member_id: string; new_cargo: string; new_role: string }; Returns: undefined }
      search_faq_articles: {
        Args: {
          p_category: string
          p_subcategory?: string | null
          p_tags?: string[] | null
          p_query?: string | null
          p_max_results?: number
        }
        Returns: {
          id: string
          title: string
          content: string
          category: string
          subcategory: string | null
          tags: string[] | null
          helpful_yes: number
          helpful_no: number
          match_strategy: string
          rank: number
        }[]
      }
      vote_faq_article: { Args: { p_article_id: string; p_helpful: boolean }; Returns: undefined }
      get_suggestion_analytics: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_chatbot_root: {
        Args: { p_category: string; p_subcategory?: string | null }
        Returns: Database['public']['Tables']['chatbot_flows']['Row'][]
      }
      get_chatbot_children: {
        Args: { p_parent_id: string }
        Returns: Database['public']['Tables']['chatbot_flows']['Row'][]
      }
      detect_support_incident: {
        Args: {
          p_category: string
          p_subcategory: string
          p_threshold?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      tenant_status: "active" | "suspended" | "canceled"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      user_role: "platform_admin" | "tenant_admin" | "collaborator" | "client"
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
      tenant_status: ["active", "suspended", "canceled"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      user_role: ["platform_admin", "tenant_admin", "collaborator", "client"],
    },
  },
} as const
