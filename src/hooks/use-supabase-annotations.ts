import { useState, useCallback, useEffect } from 'react';
import { PDFAnnotation } from '@/components/pdf-highlighter-wrapper';
import { DOCXAnnotation } from '@/components/docx-highlighter-wrapper';
import { AnnotationsService } from '@/lib/supabase/annotations';
import { DocumentAnnotation } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Annotation = PDFAnnotation | DOCXAnnotation;

interface UseSupabaseAnnotationsProps {
  documentId: string;
  documentName: string;
  documentType: 'pdf' | 'docx' | 'txt';
  userId?: string;
  enableRealtime?: boolean;
}

export function useSupabaseAnnotations({
  documentId,
  documentName,
  documentType,
  userId,
  enableRealtime = true
}: UseSupabaseAnnotationsProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Convert between local and database formats
  const toDbAnnotation = (annotation: Annotation): Omit<DocumentAnnotation, 'id' | 'created_at' | 'updated_at'> => {
    const base = {
      document_id: documentId,
      document_name: documentName,
      document_type: documentType,
      annotation_type: 'highlight' as const,
      text: annotation.text,
      color: annotation.color,
      comment: annotation.comment,
      severity: annotation.severity,
      violation_id: annotation.violationId,
      user_id: userId
    };

    if ('pageNumber' in annotation) {
      // PDF annotation
      return {
        ...base,
        page_number: annotation.pageNumber,
        position: annotation.position
      };
    } else {
      // DOCX annotation
      return {
        ...base,
        serialized_range: annotation.serializedRange
      };
    }
  };

  const fromDbAnnotation = (dbAnnotation: DocumentAnnotation): Annotation => {
    const base = {
      id: dbAnnotation.id!,
      text: dbAnnotation.text,
      color: dbAnnotation.color || '#fbbf24',
      comment: dbAnnotation.comment,
      severity: dbAnnotation.severity,
      violationId: dbAnnotation.violation_id,
      createdAt: new Date(dbAnnotation.created_at!)
    };

    if (dbAnnotation.page_number) {
      // PDF annotation
      return {
        ...base,
        pageNumber: dbAnnotation.page_number,
        position: dbAnnotation.position
      } as PDFAnnotation;
    } else {
      // DOCX annotation
      return {
        ...base,
        serializedRange: dbAnnotation.serialized_range!
      } as DOCXAnnotation;
    }
  };

  // Load annotations from database
  const loadAnnotations = useCallback(async () => {
    if (!documentId) return;
    
    setIsLoading(true);
    try {
      const data = await AnnotationsService.getByDocument(documentId);
      const converted = data.map(fromDbAnnotation);
      setAnnotations(converted);
    } catch (error) {
      console.error('Failed to load annotations:', error);
      toast({
        title: "Failed to load annotations",
        description: "Using local storage fallback",
        variant: "destructive"
      });
      
      // Fallback to localStorage
      const stored = localStorage.getItem(`annotations-${documentId}`);
      if (stored) {
        setAnnotations(JSON.parse(stored));
      }
    } finally {
      setIsLoading(false);
    }
  }, [documentId, toast]);

  // Save annotation to database
  const saveAnnotation = useCallback(async (annotation: Annotation) => {
    setIsSyncing(true);
    try {
      const dbAnnotation = toDbAnnotation(annotation);
      const saved = await AnnotationsService.create(dbAnnotation);
      
      // Update local annotation with database ID
      const updatedAnnotation = {
        ...annotation,
        id: saved.id
      };
      
      setAnnotations(prev => [...prev, updatedAnnotation]);
      
      // Also save to localStorage as backup
      const allAnnotations = [...annotations, updatedAnnotation];
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(allAnnotations));
      
      return updatedAnnotation;
    } catch (error) {
      console.error('Failed to save annotation:', error);
      toast({
        title: "Failed to save annotation",
        description: "Saved locally only",
        variant: "default"
      });
      
      // Save to localStorage only
      const allAnnotations = [...annotations, annotation];
      setAnnotations(allAnnotations);
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(allAnnotations));
      
      return annotation;
    } finally {
      setIsSyncing(false);
    }
  }, [annotations, documentId, toast]);

  // Update annotation in database
  const updateAnnotation = useCallback(async (id: string, updates: Partial<Annotation>) => {
    setIsSyncing(true);
    try {
      await AnnotationsService.update(id, {
        comment: updates.comment,
        severity: updates.severity,
        color: updates.color
      });
      
      setAnnotations(prev => 
        prev.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
      );
      
      // Update localStorage
      const updated = annotations.map(ann => 
        ann.id === id ? { ...ann, ...updates } : ann
      );
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update annotation:', error);
      toast({
        title: "Failed to update annotation",
        description: "Changes saved locally only",
        variant: "default"
      });
      
      // Update localStorage only
      setAnnotations(prev => 
        prev.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
      );
    } finally {
      setIsSyncing(false);
    }
  }, [annotations, documentId, toast]);

  // Delete annotation from database
  const deleteAnnotation = useCallback(async (id: string) => {
    setIsSyncing(true);
    try {
      await AnnotationsService.delete(id);
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
      
      // Update localStorage
      const updated = annotations.filter(ann => ann.id !== id);
      localStorage.setItem(`annotations-${documentId}`, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      toast({
        title: "Failed to delete annotation",
        description: "Removed locally only",
        variant: "default"
      });
      
      // Remove from localStorage only
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
    } finally {
      setIsSyncing(false);
    }
  }, [annotations, documentId, toast]);

  // Sync all local annotations to database
  const syncToDatabase = useCallback(async () => {
    const localAnnotations = annotations.filter(ann => !ann.id || ann.id.startsWith('ann-') || ann.id.startsWith('docx-ann-'));
    
    if (localAnnotations.length === 0) {
      toast({
        title: "Already synced",
        description: "All annotations are already saved to the database"
      });
      return;
    }
    
    setIsSyncing(true);
    try {
      const dbAnnotations = localAnnotations.map(toDbAnnotation);
      const saved = await AnnotationsService.createBatch(dbAnnotations);
      
      // Update local annotations with database IDs
      const idMap = new Map<string, string>();
      saved.forEach((dbAnn, index) => {
        idMap.set(localAnnotations[index].id, dbAnn.id!);
      });
      
      setAnnotations(prev => 
        prev.map(ann => ({
          ...ann,
          id: idMap.get(ann.id) || ann.id
        }))
      );
      
      toast({
        title: "Sync complete",
        description: `${saved.length} annotations saved to database`
      });
    } catch (error) {
      console.error('Failed to sync annotations:', error);
      toast({
        title: "Sync failed",
        description: "Could not save annotations to database",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  }, [annotations, documentId, documentName, documentType, userId, toast]);

  // Load annotations on mount
  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  // Set up real-time subscription
  useEffect(() => {
    if (!enableRealtime || !documentId) return;
    
    const subscription = AnnotationsService.subscribeToAnnotations(documentId, (payload) => {
      console.log('Real-time update:', payload);
      
      if (payload.eventType === 'INSERT') {
        const newAnnotation = fromDbAnnotation(payload.new);
        setAnnotations(prev => {
          // Check if already exists (to avoid duplicates)
          if (prev.find(ann => ann.id === newAnnotation.id)) {
            return prev;
          }
          return [...prev, newAnnotation];
        });
      } else if (payload.eventType === 'UPDATE') {
        const updatedAnnotation = fromDbAnnotation(payload.new);
        setAnnotations(prev => 
          prev.map(ann => ann.id === updatedAnnotation.id ? updatedAnnotation : ann)
        );
      } else if (payload.eventType === 'DELETE') {
        setAnnotations(prev => 
          prev.filter(ann => ann.id !== payload.old.id)
        );
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [documentId, enableRealtime]);

  return {
    annotations,
    isLoading,
    isSyncing,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
    syncToDatabase,
    refreshAnnotations: loadAnnotations
  };
}