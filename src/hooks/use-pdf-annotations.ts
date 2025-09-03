import { useState, useCallback, useEffect } from 'react';
import { PDFAnnotation } from '@/components/pdf-highlighter-wrapper';
import { useToast } from '@/hooks/use-toast';

interface UsePDFAnnotationsProps {
  documentId?: string;
  initialAnnotations?: PDFAnnotation[];
  autoSave?: boolean;
}

export function usePDFAnnotations({
  documentId,
  initialAnnotations = [],
  autoSave = true
}: UsePDFAnnotationsProps = {}) {
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>(initialAnnotations);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load annotations from localStorage or API
  useEffect(() => {
    if (documentId) {
      const stored = localStorage.getItem(`pdf-annotations-${documentId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setAnnotations(parsed.map((ann: any) => ({
            ...ann,
            createdAt: new Date(ann.createdAt)
          })));
        } catch (error) {
          console.error('Failed to load annotations:', error);
        }
      }
    }
  }, [documentId]);

  // Save annotations to localStorage or API
  const saveAnnotations = useCallback(async (anns: PDFAnnotation[]) => {
    if (!documentId || !autoSave) return;
    
    setIsSaving(true);
    try {
      // Save to localStorage for now
      localStorage.setItem(`pdf-annotations-${documentId}`, JSON.stringify(anns));
      
      // In production, save to Supabase
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // TODO: Implement Supabase save
        // await supabase.from('pdf_annotations').upsert(anns);
      }
    } catch (error) {
      console.error('Failed to save annotations:', error);
      toast({
        title: "Save failed",
        description: "Failed to save annotations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }, [documentId, autoSave, toast]);

  // Create annotation
  const createAnnotation = useCallback((annotation: PDFAnnotation) => {
    const updated = [...annotations, annotation];
    setAnnotations(updated);
    saveAnnotations(updated);
    return annotation;
  }, [annotations, saveAnnotations]);

  // Update annotation
  const updateAnnotation = useCallback((id: string, updates: Partial<PDFAnnotation>) => {
    const updated = annotations.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    );
    setAnnotations(updated);
    saveAnnotations(updated);
  }, [annotations, saveAnnotations]);

  // Delete annotation
  const deleteAnnotation = useCallback((id: string) => {
    const updated = annotations.filter(ann => ann.id !== id);
    setAnnotations(updated);
    saveAnnotations(updated);
  }, [annotations, saveAnnotations]);

  // Clear all annotations
  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    if (documentId) {
      localStorage.removeItem(`pdf-annotations-${documentId}`);
    }
  }, [documentId]);

  // Export annotations
  const exportAnnotations = useCallback(() => {
    const data = {
      documentId,
      annotations,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations-${documentId || 'document'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: `${annotations.length} annotations exported successfully.`
    });
  }, [annotations, documentId, toast]);

  // Import annotations
  const importAnnotations = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.annotations && Array.isArray(data.annotations)) {
          const imported = data.annotations.map((ann: any) => ({
            ...ann,
            createdAt: new Date(ann.createdAt)
          }));
          setAnnotations(imported);
          saveAnnotations(imported);
          
          toast({
            title: "Imported",
            description: `${imported.length} annotations imported successfully.`
          });
        }
      } catch (error) {
        console.error('Failed to import annotations:', error);
        toast({
          title: "Import failed",
          description: "Failed to import annotations. Please check the file format.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  }, [saveAnnotations, toast]);

  // Get annotations by page
  const getAnnotationsByPage = useCallback((pageNumber: number) => {
    return annotations.filter(ann => ann.pageNumber === pageNumber);
  }, [annotations]);

  // Get annotations by severity
  const getAnnotationsBySeverity = useCallback((severity: PDFAnnotation['severity']) => {
    return annotations.filter(ann => ann.severity === severity);
  }, [annotations]);

  // Search annotations
  const searchAnnotations = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return annotations.filter(ann => 
      ann.text.toLowerCase().includes(lowerQuery) ||
      (ann.comment && ann.comment.toLowerCase().includes(lowerQuery))
    );
  }, [annotations]);

  return {
    annotations,
    isSaving,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    exportAnnotations,
    importAnnotations,
    getAnnotationsByPage,
    getAnnotationsBySeverity,
    searchAnnotations
  };
}