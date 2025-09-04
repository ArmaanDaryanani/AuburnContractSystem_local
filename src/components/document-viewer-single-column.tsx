"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Sparkles
} from "lucide-react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { detectDocumentType, DocumentType } from "@/lib/document-utils";
import dynamic from 'next/dynamic';
import { cn } from "@/lib/utils";

// Dynamic imports for document viewers  
const DOCXViewer = dynamic(
  () => import('./docx-mammoth-viewer').then(mod => mod.DocxMammothViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading DOCX viewer...</p>
        </div>
      </div>
    )
  }
);

const PDFViewer = dynamic(
  () => import('./pdf-viewer-component').then(mod => mod.PDFViewerComponent),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading PDF viewer...</p>
        </div>
      </div>
    )
  }
);

interface DocumentViewerSingleColumnProps {
  file: File | null;
  violations: ViolationDetail[];
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

export function DocumentViewerSingleColumn({
  file,
  violations,
  onAnalyze,
  isAnalyzing
}: DocumentViewerSingleColumnProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.UNKNOWN);
  const [zoom, setZoom] = useState(100);
  const [expandedViolationId, setExpandedViolationId] = useState<string | null>(null);
  const [highlightedViolations, setHighlightedViolations] = useState<Set<string>>(new Set());
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      const docInfo = detectDocumentType(file);
      setDocumentType(docInfo.type);
    }
  }, [file]);

  useEffect(() => {
    // Apply inline highlights after document loads
    if (violations.length > 0 && viewerRef.current) {
      setTimeout(() => applyInlineHighlights(), 1000);
    }
  }, [violations]);

  const applyInlineHighlights = () => {
    if (!viewerRef.current || !violations.length) return;

    violations.forEach(violation => {
      if (!violation.clause || violation.clause.length < 20) return;

      const searchText = violation.clause.substring(0, 50).toLowerCase();
      const walker = document.createTreeWalker(
        viewerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      let found = false;
      while ((node = walker.nextNode()) && !found) {
        const text = node.nodeValue?.toLowerCase() || '';
        const index = text.indexOf(searchText.substring(0, 40));
        
        if (index !== -1 && node.parentElement) {
          const span = document.createElement('span');
          span.className = `violation-inline-highlight violation-${violation.severity?.toLowerCase() || 'medium'}`;
          span.setAttribute('data-violation-id', violation.id);
          
          const originalText = node.nodeValue || '';
          const matchLength = Math.min(100, originalText.length - index);
          const before = originalText.substring(0, index);
          const match = originalText.substring(index, index + matchLength);
          const after = originalText.substring(index + matchLength);
          
          const parent = node.parentElement;
          
          if (before) {
            parent.insertBefore(document.createTextNode(before), node);
          }
          
          // Create highlighted text with expandable violation details
          const highlightContainer = document.createElement('span');
          highlightContainer.className = 'violation-highlight-container';
          highlightContainer.innerHTML = `
            <span class="highlighted-text">${match}</span>
            <div class="violation-popover" id="popover-${violation.id}">
              <div class="violation-popover-content">
                <div class="violation-header">
                  <span class="violation-type">${violation.type}</span>
                  <span class="violation-severity severity-${violation.severity?.toLowerCase()}">${violation.severity}</span>
                </div>
                <p class="violation-description">${violation.description}</p>
                <div class="violation-suggestion">
                  <strong>Suggested Fix:</strong> ${violation.suggestion}
                </div>
                ${violation.farReference ? `<div class="violation-reference">FAR Reference: ${violation.farReference}</div>` : ''}
                ${violation.auburnPolicy ? `<div class="violation-policy">Auburn Policy: ${violation.auburnPolicy}</div>` : ''}
              </div>
            </div>
          `;
          
          // Add click handler
          highlightContainer.onclick = (e) => {
            e.stopPropagation();
            const popover = document.getElementById(`popover-${violation.id}`);
            if (popover) {
              const isVisible = popover.style.display === 'block';
              // Hide all other popovers
              document.querySelectorAll('.violation-popover').forEach(p => {
                (p as HTMLElement).style.display = 'none';
              });
              // Toggle current popover
              popover.style.display = isVisible ? 'none' : 'block';
            }
          };
          
          span.appendChild(highlightContainer);
          parent.insertBefore(span, node);
          
          if (after) {
            node.nodeValue = after;
          } else {
            parent.removeChild(node);
          }
          
          found = true;
        }
      }
    });

    // Add global click handler to close popovers when clicking outside
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.violation-highlight-container')) {
        document.querySelectorAll('.violation-popover').forEach(p => {
          (p as HTMLElement).style.display = 'none';
        });
      }
    });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const handleViolationClick = (violationId: string) => {
    setExpandedViolationId(expandedViolationId === violationId ? null : violationId);
    
    // Scroll to the violation in the document
    const element = viewerRef.current?.querySelector(`[data-violation-id="${violationId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!file) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">No document loaded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm h-full">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">{file.name}</span>
            <Badge variant="outline" className="text-xs">
              {documentType}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {!violations.length && onAnalyze && (
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Compliance
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-600 min-w-[40px] text-center">
              {zoom}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleResetZoom}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Reset Zoom"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Violations summary bar */}
        {violations.length > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Shield className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-gray-900">
              {violations.length} compliance {violations.length === 1 ? 'issue' : 'issues'} found
            </span>
            <div className="flex gap-2 ml-auto">
              {violations.filter(v => v.severity === 'CRITICAL').length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {violations.filter(v => v.severity === 'CRITICAL').length} Critical
                </Badge>
              )}
              {violations.filter(v => v.severity === 'HIGH').length > 0 && (
                <Badge className="bg-orange-500 text-white text-xs">
                  {violations.filter(v => v.severity === 'HIGH').length} High
                </Badge>
              )}
              {violations.filter(v => v.severity === 'MEDIUM').length > 0 && (
                <Badge className="bg-yellow-500 text-white text-xs">
                  {violations.filter(v => v.severity === 'MEDIUM').length} Medium
                </Badge>
              )}
              {violations.filter(v => v.severity === 'LOW').length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {violations.filter(v => v.severity === 'LOW').length} Low
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document viewer with inline highlights */}
      <CardContent className="p-0 relative">
        <div ref={viewerRef} className="document-viewer-container">
          {/* Add styles for inline highlights and popovers */}
          <style jsx global>{`
            .violation-inline-highlight {
              position: relative;
              cursor: pointer;
              transition: all 0.2s;
              border-radius: 3px;
              padding: 2px 4px;
              margin: 0 2px;
            }
            
            .violation-highlight-container {
              position: relative;
              display: inline;
            }
            
            .highlighted-text {
              background-color: rgba(250, 204, 21, 0.3);
              border-bottom: 2px solid #f59e0b;
              cursor: pointer;
              padding: 2px 4px;
              border-radius: 3px;
              transition: all 0.2s;
            }
            
            .highlighted-text:hover {
              background-color: rgba(250, 204, 21, 0.5);
            }
            
            .violation-critical .highlighted-text {
              background-color: rgba(239, 68, 68, 0.3);
              border-bottom-color: #dc2626;
            }
            
            .violation-high .highlighted-text {
              background-color: rgba(251, 146, 60, 0.3);
              border-bottom-color: #ea580c;
            }
            
            .violation-medium .highlighted-text {
              background-color: rgba(250, 204, 21, 0.3);
              border-bottom-color: #f59e0b;
            }
            
            .violation-low .highlighted-text {
              background-color: rgba(156, 163, 175, 0.3);
              border-bottom-color: #6b7280;
            }
            
            .violation-popover {
              display: none;
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              margin-top: 8px;
              z-index: 1000;
              min-width: 350px;
              max-width: 450px;
            }
            
            .violation-popover::before {
              content: '';
              position: absolute;
              top: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-bottom: 8px solid white;
              filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.1));
            }
            
            .violation-popover-content {
              background: white;
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
              border: 1px solid #e5e7eb;
              padding: 16px;
            }
            
            .violation-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .violation-type {
              font-weight: 600;
              font-size: 14px;
              color: #1f2937;
            }
            
            .violation-severity {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            
            .severity-critical {
              background-color: #fef2f2;
              color: #dc2626;
            }
            
            .severity-high {
              background-color: #fff7ed;
              color: #ea580c;
            }
            
            .severity-medium {
              background-color: #fefce8;
              color: #f59e0b;
            }
            
            .severity-low {
              background-color: #f9fafb;
              color: #6b7280;
            }
            
            .violation-description {
              font-size: 13px;
              color: #4b5563;
              margin-bottom: 12px;
              line-height: 1.5;
            }
            
            .violation-suggestion {
              background-color: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 6px;
              padding: 10px;
              font-size: 12px;
              color: #166534;
              margin-bottom: 8px;
              line-height: 1.4;
            }
            
            .violation-suggestion strong {
              display: block;
              margin-bottom: 4px;
              color: #14532d;
            }
            
            .violation-reference,
            .violation-policy {
              font-size: 11px;
              color: #6b7280;
              margin-top: 8px;
              padding: 6px;
              background-color: #f9fafb;
              border-radius: 4px;
            }
          `}</style>
          
          <div className="relative" style={{ minHeight: '600px' }}>
            {documentType === DocumentType.DOCX && (
              <DOCXViewer
                file={file}
                violations={violations}
                zoom={zoom}
              />
            )}
            {documentType === DocumentType.PDF && (
              <PDFViewer
                file={file}
                violations={violations}
                zoom={zoom}
              />
            )}
            {documentType === DocumentType.TXT && (
              <div className="p-6 h-full overflow-auto bg-white">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {/* Text content would be loaded here */}
                </pre>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}