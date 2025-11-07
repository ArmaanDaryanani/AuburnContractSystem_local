"use client";

import React, { useEffect, useRef, useState } from "react";
import Mark from "mark.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Eye,
  EyeOff
} from "lucide-react";

interface Violation {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title?: string;
  description: string;
  problematicText?: string;
  suggestion?: string;
  location?: string;
  isMissingClause?: boolean;
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
  const contentRef = useRef<HTMLDivElement>(null);
  const markInstance = useRef<Mark | null>(null);
  
  // Filter out MISSING_CLAUSE violations - they shouldn't be highlighted
  const highlightableViolations = violations.filter(v => 
    v.problematicText && 
    v.problematicText !== 'MISSING_CLAUSE' &&
    !v.isMissingClause
  );

  // Apply mark.js highlighting
  useEffect(() => {
    if (!contentRef.current || !highlightEnabled || highlightableViolations.length === 0) {
      // Clear highlights if disabled
      if (markInstance.current) {
        markInstance.current.unmark();
      }
      return;
    }
    
    // Initialize mark.js instance
    if (!markInstance.current) {
      markInstance.current = new Mark(contentRef.current);
    }
    
    // Clear previous highlights
    markInstance.current.unmark();
    
    // Apply highlights for each violation
    highlightableViolations.forEach((violation) => {
      if (!violation.problematicText) return;
      
      const className = `highlight-${violation.severity.toLowerCase()}`;
      const isSelected = selectedViolationId === violation.id;
      
      markInstance.current!.mark(violation.problematicText, {
        className: isSelected ? `${className} highlight-selected` : className,
        element: 'mark',
        separateWordSearch: false,
        accuracy: 'complementary', // More flexible matching
        each: (element: HTMLElement) => {
          element.setAttribute('data-violation-id', violation.id);
          element.style.cursor = 'pointer';
          element.title = violation.description;
          
          // Add click handler
          element.onclick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (onViolationClick) {
              onViolationClick(violation.id);
            }
          };
          
          // Scroll to element if selected
          if (isSelected) {
            setTimeout(() => {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        }
      });
    });
    
  }, [highlightEnabled, highlightableViolations, selectedViolationId, contractText, onViolationClick]);

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
              {highlightableViolations.length} issues highlighted
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
              <div 
                ref={contentRef}
                className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-700"
              >
                {contractText}
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
