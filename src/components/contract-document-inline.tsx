"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Eye,
  EyeOff
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

interface ContractDocumentInlineProps {
  contractText: string;
  violations: Violation[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
}

export function ContractDocumentInline({
  contractText,
  violations,
  selectedViolationId,
  onViolationClick
}: ContractDocumentInlineProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  
  // Use external selectedViolationId if provided, otherwise manage locally
  const selectedViolation = selectedViolationId !== undefined ? selectedViolationId : null;

  // Process contract text to highlight violations
  const highlightedContent = useMemo(() => {
    if (!highlightEnabled || violations.length === 0 || !contractText) {
      return contractText || "No contract text available";
    }

    let processedText = contractText;
    const highlights: { text: string; violation: Violation; start: number; end: number }[] = [];

    // Find all violation text positions
    violations.forEach(violation => {
      if (violation.problematicText) {
        const searchText = violation.problematicText;
        let index = processedText.toLowerCase().indexOf(searchText.toLowerCase());
        
        if (index !== -1) {
          highlights.push({
            text: processedText.substring(index, index + searchText.length),
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
      const isDimmed = selectedViolation && selectedViolation !== violation.id;
      
      const severityColors = {
        CRITICAL: isSelected ? "bg-red-200 text-red-900" : "bg-red-100 text-red-900",
        HIGH: isSelected ? "bg-orange-200 text-orange-900" : "bg-orange-100 text-orange-900",
        MEDIUM: isSelected ? "bg-yellow-200 text-yellow-900" : "bg-yellow-100 text-yellow-900",
        LOW: isSelected ? "bg-blue-200 text-blue-900" : "bg-blue-100 text-blue-900"
      };

      parts.unshift(
        <span
          key={`highlight-${violation.id}-${start}`}
          className={cn(
            "inline px-0.5 rounded cursor-pointer transition-all duration-300",
            severityColors[violation.severity],
            isSelected && "font-semibold",
            isDimmed && "opacity-25 grayscale-[30%]",
            !isDimmed && !isSelected && "hover:brightness-110"
          )}
          onClick={() => {
            if (onViolationClick) {
              onViolationClick(violation.id);
            }
          }}
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

  if (!contractText) {
    return null;
  }

  return (
    <Card 
      id="contract-document-viewer" 
      className="border-gray-200 shadow-sm"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <CardTitle className="text-sm font-semibold">Contract Document</CardTitle>
            <Badge variant="outline" className="text-xs">
              {violations.length} issues highlighted
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHighlightEnabled(!highlightEnabled)}
            className="h-7 text-xs"
          >
            {highlightEnabled ? (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Highlights On
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                Highlights Off
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[520px] w-full">
          <div className="p-4">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-700">
                {highlightEnabled && violations.length > 0 ? (
                  <>{highlightedContent}</>
                ) : (
                  contractText
                )}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}