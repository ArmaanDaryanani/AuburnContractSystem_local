"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import rangy from 'rangy';
import 'rangy/lib/rangy-classapplier';
import 'rangy/lib/rangy-highlighter';
import 'rangy/lib/rangy-serializer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText,
  Highlighter,
  Save,
  Trash2,
  MessageSquare,
  Download,
  Upload,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DOCXAnnotation {
  id: string;
  text: string;
  serializedRange: string;
  color: string;
  comment?: string;
  violationId?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: Date;
}

interface DOCXHighlighterProps {
  htmlContent: string;
  annotations?: DOCXAnnotation[];
  onAnnotationCreate?: (annotation: DOCXAnnotation) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationUpdate?: (id: string, updates: Partial<DOCXAnnotation>) => void;
  violationHighlights?: Array<{
    id: string;
    text: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export function DOCXHighlighter({
  htmlContent,
  annotations = [],
  onAnnotationCreate,
  onAnnotationDelete,
  onAnnotationUpdate,
  violationHighlights = []
}: DOCXHighlighterProps) {
  const [localAnnotations, setLocalAnnotations] = useState<DOCXAnnotation[]>(annotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState<DOCXAnnotation | null>(null);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [highlighter, setHighlighter] = useState<any>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize rangy and highlighter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      rangy.init();
      
      // Create highlighter instance
      const highlighterInstance = rangy.createHighlighter();
      
      // Add CSS classes for different severities
      highlighterInstance.addClassApplier(rangy.createClassApplier('highlight-critical', {
        ignoreWhiteSpace: true,
        elementTagName: 'mark',
        elementProperties: {
          'data-severity': 'CRITICAL'
        }
      }));
      
      highlighterInstance.addClassApplier(rangy.createClassApplier('highlight-high', {
        ignoreWhiteSpace: true,
        elementTagName: 'mark',
        elementProperties: {
          'data-severity': 'HIGH'
        }
      }));
      
      highlighterInstance.addClassApplier(rangy.createClassApplier('highlight-medium', {
        ignoreWhiteSpace: true,
        elementTagName: 'mark',
        elementProperties: {
          'data-severity': 'MEDIUM'
        }
      }));
      
      highlighterInstance.addClassApplier(rangy.createClassApplier('highlight-low', {
        ignoreWhiteSpace: true,
        elementTagName: 'mark',
        elementProperties: {
          'data-severity': 'LOW'
        }
      }));
      
      setHighlighter(highlighterInstance);
    }
  }, []);

  // Update local annotations when props change
  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  // Restore highlights from annotations
  useEffect(() => {
    if (highlighter && contentRef.current && localAnnotations.length > 0) {
      // Clear existing highlights
      highlighter.removeAllHighlights();
      
      // Restore each annotation
      localAnnotations.forEach(annotation => {
        try {
          const deserializedRange = rangy.deserializeRange(
            annotation.serializedRange,
            contentRef.current
          );
          
          const className = `highlight-${annotation.severity?.toLowerCase() || 'low'}`;
          highlighter.highlightRanges(className, [deserializedRange]);
        } catch (error) {
          console.error('Failed to restore highlight:', error);
        }
      });
    }
  }, [highlighter, localAnnotations, htmlContent]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const selection = rangy.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text) {
        setSelectedText(text);
      }
    }
  }, []);

  // Create annotation with severity
  const createAnnotation = (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (!selectedText || !contentRef.current) return;

    const selection = rangy.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const serializedRange = rangy.serializeRange(range, true, contentRef.current);

    const annotation: DOCXAnnotation = {
      id: `docx-ann-${Date.now()}`,
      text: selectedText,
      serializedRange,
      color: getSeverityColor(severity),
      severity,
      createdAt: new Date()
    };

    // Apply highlight
    const className = `highlight-${severity.toLowerCase()}`;
    if (highlighter) {
      highlighter.highlightSelection(className);
    }

    setLocalAnnotations([...localAnnotations, annotation]);
    if (onAnnotationCreate) {
      onAnnotationCreate(annotation);
    }

    // Clear selection
    selection.removeAllRanges();
    setSelectedText('');

    toast({
      title: "Annotation created",
      description: "Your highlight has been saved."
    });
  };

  // Delete annotation
  const deleteAnnotation = (id: string) => {
    const annotation = localAnnotations.find(a => a.id === id);
    if (annotation && highlighter && contentRef.current) {
      try {
        // Remove the highlight
        const deserializedRange = rangy.deserializeRange(
          annotation.serializedRange,
          contentRef.current
        );
        highlighter.unhighlightRanges([deserializedRange]);
      } catch (error) {
        console.error('Failed to remove highlight:', error);
      }
    }

    setLocalAnnotations(localAnnotations.filter(a => a.id !== id));
    if (onAnnotationDelete) {
      onAnnotationDelete(id);
    }
    setSelectedAnnotation(null);

    toast({
      title: "Annotation deleted",
      description: "The highlight has been removed."
    });
  };

  // Add comment to annotation
  const addComment = () => {
    if (selectedAnnotation && commentText) {
      const updated = { ...selectedAnnotation, comment: commentText };
      setLocalAnnotations(localAnnotations.map(a => 
        a.id === selectedAnnotation.id ? updated : a
      ));
      
      if (onAnnotationUpdate) {
        onAnnotationUpdate(selectedAnnotation.id, { comment: commentText });
      }
      
      setIsAddingComment(false);
      setCommentText('');
      setSelectedAnnotation(updated);

      toast({
        title: "Comment added",
        description: "Your comment has been saved."
      });
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#ca8a04';
      case 'LOW': return '#2563eb';
      default: return '#fbbf24';
    }
  };

  // Export annotations
  const exportAnnotations = () => {
    const data = {
      annotations: localAnnotations,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docx-annotations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: `${localAnnotations.length} annotations exported successfully.`
    });
  };

  // Import annotations
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
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
              setLocalAnnotations(imported);
              
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
      }
    };
    input.click();
  };

  // Filter annotations
  const filteredAnnotations = severityFilter === "all" 
    ? localAnnotations 
    : localAnnotations.filter(a => a.severity === severityFilter);

  // Severity stats
  const severityStats = {
    CRITICAL: localAnnotations.filter(a => a.severity === 'CRITICAL').length,
    HIGH: localAnnotations.filter(a => a.severity === 'HIGH').length,
    MEDIUM: localAnnotations.filter(a => a.severity === 'MEDIUM').length,
    LOW: localAnnotations.filter(a => a.severity === 'LOW').length
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* DOCX Viewer */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <CardTitle className="text-sm">DOCX Document</CardTitle>
              <Badge variant="outline">{localAnnotations.length} annotations</Badge>
            </div>
            
            {/* Highlight toolbar */}
            {selectedText && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('LOW')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-blue-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('MEDIUM')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-yellow-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('HIGH')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-orange-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('CRITICAL')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-red-700" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div 
              ref={contentRef}
              className="prose prose-sm max-w-none p-4 docx-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              onMouseUp={handleMouseUp}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Annotations Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Highlighter className="h-4 w-4" />
              <CardTitle className="text-sm">Annotations</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleImport}>
                <Upload className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={exportAnnotations}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({localAnnotations.length})</SelectItem>
                <SelectItem value="CRITICAL">Critical ({severityStats.CRITICAL})</SelectItem>
                <SelectItem value="HIGH">High ({severityStats.HIGH})</SelectItem>
                <SelectItem value="MEDIUM">Medium ({severityStats.MEDIUM})</SelectItem>
                <SelectItem value="LOW">Low ({severityStats.LOW})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[550px]">
            <div className="space-y-2">
              {filteredAnnotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {severityFilter === "all" 
                    ? "Select text in the document to create annotations"
                    : `No ${severityFilter.toLowerCase()} severity annotations`}
                </p>
              ) : (
                filteredAnnotations.map(annotation => (
                  <div
                    key={annotation.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-all",
                      selectedAnnotation?.id === annotation.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedAnnotation(annotation)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge 
                        variant="outline"
                        style={{ 
                          backgroundColor: annotation.color + '20',
                          borderColor: annotation.color 
                        }}
                      >
                        {annotation.severity || 'Note'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(annotation.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-xs font-medium mb-1 line-clamp-2">
                      "{annotation.text}"
                    </p>
                    
                    {annotation.comment && (
                      <p className="text-xs text-muted-foreground italic mt-2">
                        {annotation.comment}
                      </p>
                    )}
                    
                    {selectedAnnotation?.id === annotation.id && (
                      <div className="mt-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingComment(true);
                            setCommentText(annotation.comment || '');
                          }}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotation(annotation.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* Comment input */}
              {isAddingComment && selectedAnnotation && (
                <div className="p-3 border rounded-lg bg-muted/50">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="mb-2 text-xs"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={addComment}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingComment(false);
                        setCommentText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <style jsx global>{`
        .highlight-critical {
          background-color: #fca5a5;
          border-bottom: 2px solid #dc2626;
        }
        .highlight-high {
          background-color: #fdba74;
          border-bottom: 2px solid #ea580c;
        }
        .highlight-medium {
          background-color: #fcd34d;
          border-bottom: 2px solid #ca8a04;
        }
        .highlight-low {
          background-color: #93c5fd;
          border-bottom: 2px solid #2563eb;
        }
        .docx-content mark {
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .docx-content mark:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}