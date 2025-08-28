"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  FileText, 
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ContractDocumentViewerProps {
  contractText: string;
  violations: Violation[];
  isOpen: boolean;
  onClose: () => void;
}

export function ContractDocumentViewer({
  contractText,
  violations,
  isOpen,
  onClose
}: ContractDocumentViewerProps) {
  const [selectedViolation, setSelectedViolation] = useState<string | null>(null);
  const [highlightEnabled, setHighlightEnabled] = useState(true);

  // Process contract text to highlight violations
  const highlightedContent = useMemo(() => {
    if (!highlightEnabled || violations.length === 0) {
      return contractText;
    }

    let processedText = contractText;
    const highlights: { text: string; violation: Violation; start: number; end: number }[] = [];

    // Find all violation text positions
    violations.forEach(violation => {
      if (violation.problematicText) {
        const searchText = violation.problematicText;
        let index = processedText.indexOf(searchText);
        
        if (index !== -1) {
          highlights.push({
            text: searchText,
            violation,
            start: index,
            end: index + searchText.length
          });
        }
      }
    });

    // Sort highlights by position (reverse order for replacement)
    highlights.sort((a, b) => b.start - a.start);

    // Build highlighted HTML
    const parts: React.ReactNode[] = [];
    let lastEnd = processedText.length;

    highlights.forEach(({ text, violation, start, end }) => {
      // Add text after this highlight
      if (end < lastEnd) {
        parts.unshift(
          <span key={`text-${start}`}>
            {processedText.substring(end, lastEnd)}
          </span>
        );
      }

      // Add highlighted text
      const isSelected = selectedViolation === violation.id;
      const severityColors = {
        CRITICAL: "bg-red-200 border-red-400",
        HIGH: "bg-orange-200 border-orange-400",
        MEDIUM: "bg-yellow-200 border-yellow-400",
        LOW: "bg-blue-200 border-blue-400"
      };

      parts.unshift(
        <span
          key={`highlight-${violation.id}-${start}`}
          className={cn(
            "inline-block px-1 rounded border-b-2 cursor-pointer transition-all",
            severityColors[violation.severity],
            isSelected && "ring-2 ring-offset-1 ring-gray-600",
            "hover:brightness-90"
          )}
          onClick={() => setSelectedViolation(violation.id)}
          title={violation.title || violation.description}
        >
          {text}
        </span>
      );

      lastEnd = start;
    });

    // Add remaining text at the beginning
    if (lastEnd > 0) {
      parts.unshift(
        <span key="text-start">
          {processedText.substring(0, lastEnd)}
        </span>
      );
    }

    return parts;
  }, [contractText, violations, highlightEnabled, selectedViolation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl h-[90vh] flex flex-col bg-white">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-gray-700" />
              <CardTitle>Contract Document with Highlighted Issues</CardTitle>
              <Badge variant="outline" className="ml-2">
                {violations.length} violations found
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHighlightEnabled(!highlightEnabled)}
              >
                {highlightEnabled ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Highlights On
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Highlights Off
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex h-full">
            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden border-r">
              <ScrollArea className="h-full p-6">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {highlightEnabled ? (
                      <>{highlightedContent}</>
                    ) : (
                      contractText
                    )}
                  </pre>
                </div>
              </ScrollArea>
            </div>

            {/* Violations Panel */}
            <div className="w-96 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-sm">Compliance Issues</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Click on highlighted text or select an issue below
                </p>
              </div>
              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="p-4 space-y-3">
                  {violations.map((violation) => {
                    const isSelected = selectedViolation === violation.id;
                    const severityColors = {
                      CRITICAL: "border-red-400 bg-red-50",
                      HIGH: "border-orange-400 bg-orange-50",
                      MEDIUM: "border-yellow-400 bg-yellow-50",
                      LOW: "border-blue-400 bg-blue-50"
                    };
                    const badgeVariants = {
                      CRITICAL: "destructive" as const,
                      HIGH: "destructive" as const,
                      MEDIUM: "secondary" as const,
                      LOW: "outline" as const
                    };

                    return (
                      <Card
                        key={violation.id}
                        className={cn(
                          "cursor-pointer transition-all border-2",
                          isSelected ? severityColors[violation.severity] : "hover:shadow-md",
                          isSelected && "ring-2 ring-gray-600"
                        )}
                        onClick={() => setSelectedViolation(violation.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <Badge variant={badgeVariants[violation.severity]}>
                              {violation.severity}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {violation.type}
                            </span>
                          </div>
                          
                          {violation.title && (
                            <h4 className="font-semibold text-sm mb-1">
                              {violation.title}
                            </h4>
                          )}
                          
                          <p className="text-xs text-gray-700 mb-2">
                            {violation.description}
                          </p>
                          
                          {violation.problematicText && (
                            <div className="bg-white/80 p-2 rounded text-xs mb-2 border">
                              <span className="font-medium">Text: </span>
                              "{violation.problematicText.substring(0, 100)}
                              {violation.problematicText.length > 100 && '...'}"
                            </div>
                          )}
                          
                          {violation.suggestion && (
                            <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                              <span className="font-medium">Suggestion: </span>
                              {violation.suggestion}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}