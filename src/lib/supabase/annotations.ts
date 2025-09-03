import { supabase, DocumentAnnotation } from './client';

export class AnnotationsService {
  // Create a new annotation
  static async create(annotation: Omit<DocumentAnnotation, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('document_annotations')
      .insert([annotation])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating annotation:', error);
      throw error;
    }
    
    return data;
  }

  // Get all annotations for a document
  static async getByDocument(documentId: string) {
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching annotations:', error);
      throw error;
    }
    
    return data || [];
  }

  // Get annotations by severity
  static async getBySeverity(documentId: string, severity: string) {
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .eq('severity', severity)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching annotations by severity:', error);
      throw error;
    }
    
    return data || [];
  }

  // Update an annotation
  static async update(id: string, updates: Partial<DocumentAnnotation>) {
    const { data, error } = await supabase
      .from('document_annotations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
    
    return data;
  }

  // Delete an annotation
  static async delete(id: string) {
    const { error } = await supabase
      .from('document_annotations')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
    
    return true;
  }

  // Batch create annotations
  static async createBatch(annotations: Omit<DocumentAnnotation, 'id' | 'created_at' | 'updated_at'>[]) {
    const { data, error } = await supabase
      .from('document_annotations')
      .insert(annotations)
      .select();
    
    if (error) {
      console.error('Error creating batch annotations:', error);
      throw error;
    }
    
    return data || [];
  }

  // Delete all annotations for a document
  static async deleteByDocument(documentId: string) {
    const { error } = await supabase
      .from('document_annotations')
      .delete()
      .eq('document_id', documentId);
    
    if (error) {
      console.error('Error deleting document annotations:', error);
      throw error;
    }
    
    return true;
  }

  // Subscribe to real-time updates
  static subscribeToAnnotations(documentId: string, callback: (payload: any) => void) {
    const subscription = supabase
      .channel(`annotations:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_annotations',
          filter: `document_id=eq.${documentId}`
        },
        callback
      )
      .subscribe();
    
    return subscription;
  }

  // Search annotations by text
  static async searchByText(documentId: string, searchText: string) {
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .or(`text.ilike.%${searchText}%,comment.ilike.%${searchText}%`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error searching annotations:', error);
      throw error;
    }
    
    return data || [];
  }

  // Get annotations with FAR references
  static async getWithFARReferences(documentId: string) {
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .not('far_reference', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching FAR annotations:', error);
      throw error;
    }
    
    return data || [];
  }

  // Get annotations with Auburn policies
  static async getWithAuburnPolicies(documentId: string) {
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .not('auburn_policy', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching Auburn policy annotations:', error);
      throw error;
    }
    
    return data || [];
  }
}