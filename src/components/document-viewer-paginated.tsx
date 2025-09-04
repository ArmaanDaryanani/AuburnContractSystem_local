"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  AlertCircle, 
  Shield,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Sparkles,
  Eye,
  FileX
} from "lucide-react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { detectDocumentType, DocumentType } from "@/lib/document-utils";
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
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showSinglePage, setShowSinglePage] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (file) {
      const docInfo = detectDocumentType(file);
      setDocumentType(docInfo.type);
    }
  }, [file]);

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
  
  const handlePreviousPage = () => {
    if (showSinglePage) {
      setCurrentPage(prev => Math.max(1, prev - 1));
    } else {
      setCurrentPage(prev => Math.max(1, prev - 2));
    }
  };
  
  const handleNextPage = () => {
    if (showSinglePage) {
      setCurrentPage(prev => Math.min(totalPages, prev + 1));
    } else {
      setCurrentPage(prev => Math.min(totalPages - 1, prev + 2));
    }
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
            </div>
          </div>
        )}
      </div>

      {/* Document viewer with pagination */}
      <CardContent className="p-0 relative h-full">
        <div ref={viewerRef} className="document-viewer-paginated h-full">
          <div className="bg-gray-100" style={{ height: 'calc(100vh - 140px)' }}>
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

        {/* Page Navigation Footer */}
        {totalPages > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleFirstPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Previous"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {getPageDisplay()}
                </span>
                
                {/* Quick page jump input */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Go to:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value) || 1;
                      setCurrentPage(Math.min(Math.max(1, page), totalPages));
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleNextPage}
                  disabled={currentPage >= (showSinglePage ? totalPages : totalPages - 1)}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Next"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  onClick={handleLastPage}
                  disabled={currentPage >= (showSinglePage ? totalPages : totalPages - 1)}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}