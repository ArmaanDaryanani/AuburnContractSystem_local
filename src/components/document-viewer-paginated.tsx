"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Sparkles,
  FileX
} from "lucide-react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { detectDocumentType, DocumentType } from "@/lib/document-utils";
import { ViolationsBar } from "@/components/violations-bar";
import { ViolationPopup } from "@/components/violation-popup";
import dynamic from 'next/dynamic';
import { cn } from "@/lib/utils";

// Dynamic imports for document viewers  
const DOCXViewerPaginated = dynamic(
  () => import('./docx-viewer-paginated').then(mod => mod.DocxViewerPaginated),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[800px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }
);

const PDFViewerPaginated = dynamic(
  () => import('./pdf-viewer-paginated').then(mod => mod.PDFViewerPaginated),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[800px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }
);

interface DocumentViewerPaginatedProps {
  file: File | null;
  violations: ViolationDetail[];
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  onTextExtracted?: (text: string) => void;
}

export function DocumentViewerPaginated({
  file,
  violations,
  onAnalyze,
  isAnalyzing,
  onTextExtracted
}: DocumentViewerPaginatedProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.UNKNOWN);
  const [zoom, setZoom] = useState(85);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showSinglePage, setShowSinglePage] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<ViolationDetail | null>(null);
  const [activeViolationId, setActiveViolationId] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      const docInfo = detectDocumentType(file);
      setDocumentType(docInfo.type);
    }
  }, [file]);

  // Re-apply active highlight when page changes
  useEffect(() => {
    if (activeViolationId && viewerRef.current) {
      const timer = setTimeout(() => {
        const allHighlights = viewerRef.current?.querySelectorAll('.violation-highlight-container');
        allHighlights?.forEach((el) => {
          const elViolationId = (el as HTMLElement).getAttribute('data-violation-id');
          if (elViolationId && activeViolationId.includes(elViolationId)) {
            (el as HTMLElement).classList.add('violation-active');
            (el as HTMLElement).style.backgroundColor = 'rgba(255, 235, 59, 0.5)';
            (el as HTMLElement).style.border = '2px solid #fbbf24';
            (el as HTMLElement).style.borderRadius = '3px';
            (el as HTMLElement).style.padding = '2px';
          } else {
            (el as HTMLElement).classList.remove('violation-active');
            (el as HTMLElement).style.backgroundColor = '';
            (el as HTMLElement).style.border = '';
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, activeViolationId]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const handleFirstPage = () => setCurrentPage(1);
  const handleLastPage = () => {
    // For 2-page view, ensure we show the last page properly
    if (showSinglePage) {
      setCurrentPage(totalPages);
    } else {
      setCurrentPage(totalPages % 2 === 0 ? totalPages - 1 : totalPages);
    }
  };

  const handleViolationClick = (violation: ViolationDetail, index: number) => {
    console.log('Violation clicked:', violation);
    
    // Check if this is a missing clause violation
    if (violation.isMissingClause) {
      console.log('📑 Missing clause violation - showing modal instead of navigating');
      
      // For missing clauses, just show the popup modal with details
      setSelectedViolation(violation);
      
      // Don't navigate or try to highlight since the clause doesn't exist
      return;
    }
    
    // For found text violations, proceed with normal navigation and highlighting
    const violationId = violation.id || `${violation.type}_${index}`;
    setActiveViolationId(violationId);
    
    // Show the violation popup with the correct data
    setSelectedViolation(violation);
    
    // Use the resolved page number from our page resolution map
    const targetPage = violation.pageNumber;
    
    if (!targetPage) {
      console.log(`⚠️ Violation "${violation.id}" not found in PDF - cannot navigate`);
      return;
    }
    
    console.log(`Navigating to page ${targetPage} for violation:`, violation.id);
    setCurrentPage(targetPage);
    
    // Trigger highlight after page renders
    requestAnimationFrame(() => {
      const event = new CustomEvent('highlight-trigger');
      window.dispatchEvent(event);
    });
    
    // After page loads, try to find and highlight the specific violation
    setTimeout(() => {
      // Look for the element in the entire document viewer
      const viewerEl = viewerRef.current || document.querySelector('.document-viewer-paginated');
      if (viewerEl) {
        // Find elements with matching violation ID
        const violationElements = viewerEl.querySelectorAll('.violation-highlight-container');
        let targetEl: HTMLElement | null = null;
        
        // Try to find element with matching violation ID
        violationElements.forEach((el) => {
          const elViolationId = (el as HTMLElement).getAttribute('data-violation-id');
          // Check if IDs match (considering different ID formats)
          if (elViolationId && (
              elViolationId === violation.id || 
              elViolationId === violation.type ||
              violation.id?.includes(elViolationId) ||
              elViolationId.includes(violation.id || '')
          )) {
            targetEl = el as HTMLElement;
          }
        });
        
        // If not found by ID, try to match by text content
        if (!targetEl && violation.clause) {
          const clauseText = violation.clause.substring(0, 30).toLowerCase();
          violationElements.forEach((el) => {
            const elText = (el.textContent || '').toLowerCase();
            if (elText.includes(clauseText)) {
              targetEl = el as HTMLElement;
            }
          });
        }
        
        // If still not found, try by index on the current page
        if (!targetEl && violationElements.length > 0) {
          // Use modulo to wrap around if index is larger than elements on page
          const pageIndex = index % violationElements.length;
          targetEl = violationElements[pageIndex] as HTMLElement;
        }
        
        console.log(`Found violation element for ${violation.type}:`, targetEl ? 'yes' : 'no');
        
        // First, clear any previous active highlights
        const allHighlights = viewerEl.querySelectorAll('.violation-highlight-container');
        allHighlights.forEach((el) => {
          (el as HTMLElement).classList.remove('violation-active');
          (el as HTMLElement).style.backgroundColor = '';
          (el as HTMLElement).style.border = '';
        });
        
        if (targetEl) {
          // Ensure the element is visible
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add persistent highlight effect
          targetEl.classList.add('violation-active');
          targetEl.style.transition = 'all 0.3s ease';
          targetEl.style.backgroundColor = 'rgba(255, 235, 59, 0.5)'; // Yellow highlight
          targetEl.style.border = '2px solid #fbbf24'; // Yellow border
          targetEl.style.borderRadius = '3px';
          targetEl.style.padding = '2px';
        }
      }
    }, 1500);
  };
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const togglePageView = () => {
    setShowSinglePage(!showSinglePage);
    // Adjust current page to ensure proper display
    if (!showSinglePage && currentPage % 2 === 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getPageDisplay = () => {
    if (showSinglePage) {
      return `Page ${currentPage} of ${totalPages}`;
    } else {
      const rightPage = Math.min(currentPage + 1, totalPages);
      return currentPage === rightPage 
        ? `Page ${currentPage} of ${totalPages}`
        : `Pages ${currentPage}-${rightPage} of ${totalPages}`;
    }
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
    <>
      <div className="h-full flex flex-col relative">
      <Card className="border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">{file.name}</span>
            <Badge variant="outline" className="text-xs">
              {documentType}
            </Badge>
          </div>
          
          {/* View and Zoom Controls */}
          <div className="flex items-center gap-3">
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
                    Analyze
                  </>
                )}
              </Button>
            )}
            
            <div className="flex items-center gap-1 border-r pr-3">
              <Button
                onClick={togglePageView}
                variant="outline"
                size="sm"
                title={showSinglePage ? "Two-page view" : "Single-page view"}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                {showSinglePage ? "Single" : "Spread"}
              </Button>
            </div>
            
            <div className="flex items-center gap-1">
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
        </div>

        {/* Violations summary bar */}
      </div>

      {/* Violations Bar */}
      {violations.length > 0 && (
        <div className="flex-shrink-0">
          <ViolationsBar 
          violations={violations}
          onViolationClick={handleViolationClick}
          selectedViolationId={activeViolationId}
          />
        </div>
      )}

      {/* Document viewer with pagination */}
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <div ref={viewerRef} className="document-viewer-paginated flex-1 min-h-0">
          <div className="bg-gray-100 h-full w-full">
            {documentType === DocumentType.DOCX && (
              <DOCXViewerPaginated
                file={file}
                violations={violations}
                zoom={zoom}
                currentPage={currentPage}
                showSinglePage={showSinglePage}
                onPageChange={setCurrentPage}
                onTotalPagesChange={setTotalPages}
                onTextExtracted={onTextExtracted}
                activeViolationId={activeViolationId}
              />
            )}
            {documentType === DocumentType.PDF && (
              <PDFViewerPaginated
                file={file}
                violations={violations}
                zoom={zoom}
                currentPage={currentPage}
                showSinglePage={showSinglePage}
                onPageChange={setCurrentPage}
                onTotalPagesChange={setTotalPages}
                onTextExtracted={onTextExtracted}
              />
            )}
            {documentType === DocumentType.TXT && (
              <div className="p-6 h-full overflow-auto bg-white">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {/* Text content would be loaded here */}
                </pre>
              </div>
            )}
            {documentType === DocumentType.UNKNOWN && (
              <div className="flex items-center justify-center h-[750px] bg-gray-50">
                <div className="text-center">
                  <FileX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Unsupported file format</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
    
    {/* Page Navigation Footer - Fixed at bottom of viewport */}
    {totalPages > 0 && (
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-gray-50 to-white border-t border-gray-200 px-4 z-50">
        <div className="h-full flex items-center justify-center gap-4">
          <Button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value) || 1;
                setCurrentPage(Math.min(Math.max(1, page), totalPages));
              }}
              className="w-14 px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-700 min-w-[2rem]">
              {totalPages}
            </span>
          </div>

          <Button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    )}
    
    {/* Violation Popup */}
    {selectedViolation && (
      <ViolationPopup 
        violation={selectedViolation}
        onClose={() => setSelectedViolation(null)}
      />
    )}
    </div>
    </>
  );
}