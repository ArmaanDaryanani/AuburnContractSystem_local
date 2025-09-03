"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DOCXHighlighter, type DOCXAnnotation } from "./docx-highlighter-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download,
  Upload,
  Trash2,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Violation {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title?: string;
  description: string;
  problematicText?: string;
  suggestion?: string;
  location?: string;
}

interface ContractDocumentInlineDOCXProps {
  file: File;
  htmlContent: string;
  violations: Violation[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
}

export function ContractDocumentInlineDOCX({
  file,
  htmlContent,
  violations,
  selectedViolationId,
  onViolationClick
}: ContractDocumentInlineDOCXProps) {
  const [annotations, setAnnotations] = useState<DOCXAnnotation[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const { toast } = useToast();
  
  const fileId = useMemo(() => `docx-${file.name}-${file.size}`, [file]);

  // Load annotations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`docx-annotations-${fileId}`);
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
  }, [fileId]);

  // Save annotations to localStorage
  const saveAnnotations = (anns: DOCXAnnotation[]) => {
    localStorage.setItem(`docx-annotations-${fileId}`, JSON.stringify(anns));
  };

  // Convert violations to highlights
  const violationHighlights = useMemo(() => {
    return violations.map(v => ({
      id: v.id,
      text: v.problematicText || v.description,
      severity: v.severity
    }));
  }, [violations]);

  // Handle annotation creation
  const handleAnnotationCreate = (annotation: DOCXAnnotation) => {
    // Check if this annotation is related to a violation
    const relatedViolation = violations.find(v => 
      annotation.text.includes(v.problematicText || '') ||
      v.problematicText?.includes(annotation.text)
    );
    
    if (relatedViolation) {
      annotation.violationId = relatedViolation.id;
      annotation.severity = relatedViolation.severity;
    }
    
    const updated = [...annotations, annotation];
    setAnnotations(updated);
    saveAnnotations(updated);
  };

  // Handle annotation deletion
  const handleAnnotationDelete = (id: string) => {
    const updated = annotations.filter(a => a.id !== id);
    setAnnotations(updated);
    saveAnnotations(updated);
  };

  // Handle annotation update
  const handleAnnotationUpdate = (id: string, updates: Partial<DOCXAnnotation>) => {
    const updated = annotations.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    );
    setAnnotations(updated);
    saveAnnotations(updated);
  };

  // Export all annotations
  const exportAnnotations = () => {
    const data = {
      documentId: fileId,
      fileName: file.name,
      annotations,
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
      description: `${annotations.length} annotations exported successfully.`
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
      }
    };
    input.click();
  };

  // Clear all annotations
  const clearAnnotations = () => {
    setAnnotations([]);
    localStorage.removeItem(`docx-annotations-${fileId}`);
    toast({
      title: "Cleared",
      description: "All annotations have been removed."
    });
  };

  // Filter annotations
  const filteredAnnotations = useMemo(() => {
    if (severityFilter === "all") return annotations;
    return annotations.filter(a => a.severity === severityFilter);
  }, [annotations, severityFilter]);

  // Severity stats
  const severityStats = useMemo(() => {
    const stats = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    
    annotations.forEach(ann => {
      if (ann.severity) {
        stats[ann.severity]++;
      }
    });
    
    return stats;
  }, [annotations]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <CardTitle className="text-sm font-semibold">DOCX Document Viewer</CardTitle>
              <Badge variant="outline" className="text-xs">
                {annotations.length} annotations
              </Badge>
              {Object.entries(severityStats).map(([severity, count]) => 
                count > 0 && (
                  <Badge
                    key={severity}
                    variant={
                      severity === 'CRITICAL' ? 'destructive' :
                      severity === 'HIGH' ? 'destructive' :
                      severity === 'MEDIUM' ? 'secondary' :
                      'outline'
                    }
                    className="text-xs"
                  >
                    {severity}: {count}
                  </Badge>
                )
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleImport}
                className="h-8 text-xs"
              >
                <Upload className="h-3 w-3 mr-1" />
                Import
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={exportAnnotations}
                disabled={annotations.length === 0}
                className="h-8 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={clearAnnotations}
                disabled={annotations.length === 0}
                className="h-8 text-xs text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* DOCX Highlighter */}
      <DOCXHighlighter
        htmlContent={htmlContent}
        annotations={filteredAnnotations}
        onAnnotationCreate={handleAnnotationCreate}
        onAnnotationDelete={handleAnnotationDelete}
        onAnnotationUpdate={handleAnnotationUpdate}
        violationHighlights={violationHighlights}
      />
    </div>
  );
}