import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our tables
export interface DocumentAnnotation {
  id?: string;
  document_id: string;
  document_name: string;
  document_type: 'pdf' | 'docx' | 'txt';
  annotation_type: 'highlight' | 'comment' | 'violation';
  text: string;
  serialized_range?: string;
  position?: any;
  page_number?: number;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color?: string;
  comment?: string;
  violation_id?: string;
  far_reference?: string;
  auburn_policy?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AnnotationCollaborator {
  id?: string;
  annotation_id: string;
  user_id: string;
  permission: 'view' | 'edit' | 'admin';
  created_at?: string;
}