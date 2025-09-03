"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  FileText,
  Highlighter,
  Save,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PDFAnnotation {
  id: string;
  pageNumber: number;
  text: string;
  position: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  color: string;
  comment?: string;
  violationId?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: Date;
}

interface PDFHighlighterProps {
  file: File;
  annotations?: PDFAnnotation[];
  onAnnotationCreate?: (annotation: PDFAnnotation) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationUpdate?: (id: string, updates: Partial<PDFAnnotation>) => void;
  violationHighlights?: Array<{
    id: string;
    text: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export function PDFHighlighter({
  file,
  annotations = [],
  onAnnotationCreate,
  onAnnotationDelete,
  onAnnotationUpdate,
  violationHighlights = []
}: PDFHighlighterProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<any>(null);
  const [localAnnotations, setLocalAnnotations] = useState<PDFAnnotation[]>(annotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState<PDFAnnotation | null>(null);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const documentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setSelectionPosition({
        x1: rect.left,
        y1: rect.top,
        x2: rect.right,
        y2: rect.bottom
      });
    } else {
      setSelectedText('');
      setSelectionPosition(null);
    }
  }, []);

  const createAnnotation = (color: string, severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (!selectedText || !selectionPosition) return;

    const annotation: PDFAnnotation = {
      id: `ann-${Date.now()}`,
      pageNumber,
      text: selectedText,
      position: selectionPosition,
      color,
      severity,
      createdAt: new Date()
    };

    setLocalAnnotations([...localAnnotations, annotation]);
    if (onAnnotationCreate) {
      onAnnotationCreate(annotation);
    }

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectedText('');
    setSelectionPosition(null);

    toast({
      title: "Annotation created",
      description: "Your highlight has been saved."
    });
  };

  const deleteAnnotation = (id: string) => {
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

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#3b82f6';
      default: return '#fbbf24';
    }
  };

  const renderAnnotations = () => {
    const pageAnnotations = localAnnotations.filter(a => a.pageNumber === pageNumber);
    
    return pageAnnotations.map(annotation => (
      <div
        key={annotation.id}
        className="absolute border-2 opacity-30 hover:opacity-50 cursor-pointer transition-opacity"
        style={{
          left: annotation.position.x1,
          top: annotation.position.y1,
          width: annotation.position.x2 - annotation.position.x1,
          height: annotation.position.y2 - annotation.position.y1,
          backgroundColor: annotation.color,
          borderColor: annotation.color
        }}
        onClick={() => setSelectedAnnotation(annotation)}
      />
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* PDF Viewer */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <CardTitle className="text-sm">PDF Document</CardTitle>
              <Badge variant="outline">{numPages} pages</Badge>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                {pageNumber} / {numPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="ml-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">{Math.round(scale * 100)}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScale(Math.min(2, scale + 0.1))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div 
              ref={documentRef}
              className="relative"
              onMouseUp={handleTextSelection}
            >
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                className="flex justify-center"
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />
              </Document>
              
              {/* Render annotations overlay */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {renderAnnotations()}
              </div>
            </div>
          </ScrollArea>
          
          {/* Highlight toolbar */}
          {selectedText && (
            <div 
              className="absolute bg-white border rounded-lg shadow-lg p-2 z-10"
              style={{
                left: selectionPosition?.x1,
                top: selectionPosition?.y2 + 5
              }}
            >
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('#fbbf24', 'LOW')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-yellow-400" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('#f97316', 'MEDIUM')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-orange-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('#ef4444', 'HIGH')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-red-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createAnnotation('#dc2626', 'CRITICAL')}
                  className="h-8 w-8 p-0"
                >
                  <div className="h-5 w-5 rounded bg-red-700" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotations Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Highlighter className="h-4 w-4" />
              <CardTitle className="text-sm">Annotations</CardTitle>
              <Badge>{localAnnotations.length}</Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {localAnnotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Select text in the PDF to create annotations
                </p>
              ) : (
                localAnnotations.map(annotation => (
                  <div
                    key={annotation.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-all",
                      selectedAnnotation?.id === annotation.id && "ring-2 ring-primary"
                    )}
                    onClick={() => {
                      setSelectedAnnotation(annotation);
                      setPageNumber(annotation.pageNumber);
                    }}
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
                        Page {annotation.pageNumber}
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
    </div>
  );
}