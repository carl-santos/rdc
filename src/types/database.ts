// Tipos do banco.
//
// Gerado por `npm run types:gen` (supabase gen types typescript --linked).
// Ate aqui foi mantido a mao para refletir supabase/migrations. Depois de
// criar o projeto no Supabase e rodar `supabase link`, regere este arquivo em
// vez de edita-lo.

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
          created_at: string
          user_id: string | null
          tenant_id: string | null
          role: string | null
          event_type: string | null
          action: string
          category: string | null
          resource_type: string
          resource_id: string | null
          severity: 'info' | 'warning' | 'critical' | null
          status: 'success' | 'error' | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          tenant_id?: string | null
          role?: string | null
          event_type?: string | null
          action: string
          category?: string | null
          resource_type: string
          resource_id?: string | null
          severity?: 'info' | 'warning' | 'critical' | null
          status?: 'success' | 'error' | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string | null
          tenant_id?: string | null
          role?: string | null
          event_type?: string | null
          action?: string
          category?: string | null
          resource_type?: string
          resource_id?: string | null
          severity?: 'info' | 'warning' | 'critical' | null
          status?: 'success' | 'error' | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        Relationships: []
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
      clients: {
        Row: {
          created_at: string | null
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          client_user_id: string | null
          telefone: string | null
          tenant_id: string
          portal_activated_at: string | null
          consent_given_at: string | null
          anonymized_at: string | null
          deleted_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          client_user_id?: string | null
          telefone?: string | null
          tenant_id: string
          portal_activated_at?: string | null
          consent_given_at?: string | null
          anonymized_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          client_user_id?: string | null
          telefone?: string | null
          tenant_id?: string
          portal_activated_at?: string | null
          consent_given_at?: string | null
          anonymized_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          id: string
          limite_clientes: number
          limite_operacoes_mes: number
          nome: string
          preco_mensal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          limite_clientes: number
          limite_operacoes_mes: number
          nome: string
          preco_mensal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          limite_clientes?: number
          limite_operacoes_mes?: number
          nome?: string
          preco_mensal?: number
        }
        Relationships: []
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
        Relationships: []
      }
      suggestion_meta: {
        Row: {
          ticket_id:   string
          status:      'unread' | 'reviewing' | 'planned' | 'implemented' | 'rejected'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at:  string | null
          updated_at:  string | null
        }
        Insert: {
          ticket_id:    string
          status?:      'unread' | 'reviewing' | 'planned' | 'implemented' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?:  string | null
          updated_at?:  string | null
        }
        Update: {
          ticket_id?:   string
          status?:      'unread' | 'reviewing' | 'planned' | 'implemented' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?:  string | null
          updated_at?:  string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          client_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          tenant_id: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string | null
          email: string
          id: string
          nome: string
          client_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          client_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          blocks_sales: boolean | null
          category: string
          confidence_score: number | null
          created_at: string | null
          description: string
          id: string
          priority: string
          read: boolean | null
          resolution_type: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory: string | null
          subject: string
          tags: string[] | null
          tenant_id: string
          ticket_number: string
          unread_messages_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blocks_sales?: boolean | null
          category: string
          confidence_score?: number | null
          created_at?: string | null
          description: string
          id?: string
          priority: string
          read?: boolean | null
          resolution_type?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory?: string | null
          subject: string
          tags?: string[] | null
          tenant_id: string
          ticket_number: string
          unread_messages_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blocks_sales?: boolean | null
          category?: string
          confidence_score?: number | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          read?: boolean | null
          resolution_type?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory?: string | null
          subject?: string
          tags?: string[] | null
          tenant_id?: string
          ticket_number?: string
          unread_messages_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string | null
          segmento: string | null
          estado: string | null
          id: string
          logo_url: string | null
          logradouro: string | null
          nome_fantasia: string
          numero: string | null
          plano_id: string | null
          razao_social: string | null
          status: Database["public"]["Enums"]["tenant_status"] | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          telefone: string | null
          whatsapp_atendimento: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          segmento?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia: string
          numero?: string | null
          plano_id?: string | null
          razao_social?: string | null
          status?: Database["public"]["Enums"]["tenant_status"] | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          telefone?: string | null
          whatsapp_atendimento?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          segmento?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string
          numero?: string | null
          plano_id?: string | null
          razao_social?: string | null
          status?: Database["public"]["Enums"]["tenant_status"] | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          telefone?: string | null
          whatsapp_atendimento?: string | null
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
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
          uploaded_by?: string | null
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
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          mes_referencia: string
          clientes_cadastrados: number | null
          operacoes_utilizadas: number | null
          creditos_extra: number
          creditos_extra_utilizados: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          mes_referencia: string
          clientes_cadastrados?: number | null
          operacoes_utilizadas?: number | null
          creditos_extra?: number
          creditos_extra_utilizados?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          mes_referencia?: string
          clientes_cadastrados?: number | null
          operacoes_utilizadas?: number | null
          creditos_extra?: number
          creditos_extra_utilizados?: number
          tenant_id?: string
          updated_at?: string | null
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
