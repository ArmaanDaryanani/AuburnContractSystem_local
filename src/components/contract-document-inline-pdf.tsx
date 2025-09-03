"use client";

import React, { useState, useMemo } from "react";
import { PDFHighlighter, type PDFAnnotation } from "./pdf-highlighter-wrapper";
import { usePDFAnnotations } from "@/hooks/use-pdf-annotations";
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

interface ContractDocumentInlinePDFProps {
  file: File;
  violations: Violation[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
}

export function ContractDocumentInlinePDF({
  file,
  violations,
  selectedViolationId,
  onViolationClick
}: ContractDocumentInlinePDFProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const fileId = useMemo(() => `pdf-${file.name}-${file.size}`, [file]);
  
  const {
    annotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    exportAnnotations,
    importAnnotations,
    getAnnotationsBySeverity
  } = usePDFAnnotations({
    documentId: fileId,
    autoSave: true
  });

  // Convert violations to highlights
  const violationHighlights = useMemo(() => {
    return violations.map(v => ({
      id: v.id,
      text: v.problematicText || v.description,
      severity: v.severity
    }));
  }, [violations]);

  // Filter annotations
  const filteredAnnotations = useMemo(() => {
    if (severityFilter === "all") return annotations;
    return getAnnotationsBySeverity(severityFilter as PDFAnnotation['severity']);
  }, [annotations, severityFilter, getAnnotationsBySeverity]);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        importAnnotations(file);
      }
    };
    input.click();
  };

  const handleAnnotationCreate = (annotation: PDFAnnotation) => {
    // Check if this annotation is related to a violation
    const relatedViolation = violations.find(v => 
      annotation.text.includes(v.problematicText || '') ||
      v.problematicText?.includes(annotation.text)
    );
    
    if (relatedViolation) {
      annotation.violationId = relatedViolation.id;
      annotation.severity = relatedViolation.severity;
    }
    
    createAnnotation(annotation);
  };

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
              <CardTitle className="text-sm font-semibold">PDF Document Viewer</CardTitle>
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

      {/* PDF Highlighter */}
      <PDFHighlighter
        file={file}
        annotations={filteredAnnotations}
        onAnnotationCreate={handleAnnotationCreate}
        onAnnotationDelete={deleteAnnotation}
        onAnnotationUpdate={updateAnnotation}
        violationHighlights={violationHighlights}
      />
    </div>
  );
}