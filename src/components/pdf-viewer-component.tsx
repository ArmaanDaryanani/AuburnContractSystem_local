"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerComponentProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom: number;
}

export function PDFViewerComponent({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom
}: PDFViewerComponentProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [fileUrl, setFileUrl] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Map<string, { page: number; text: string }>>(new Map());

  useEffect(() => {
    // Create object URL for the file
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Process violations to create highlight mappings
  useEffect(() => {
    const highlightMap = new Map<string, { page: number; text: string }>();
    violations.forEach(violation => {
      if (violation.clause) {
        // Simple mapping - in real app would need text position extraction
        highlightMap.set(violation.id, {
          page: 1, // Would need to determine actual page
          text: violation.clause
        });
      }
    });
    setHighlights(highlightMap);
  }, [violations]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const renderHighlights = () => {
    return violations.map(violation => {
      const highlight = highlights.get(violation.id);
      if (!highlight || highlight.page !== pageNumber) return null;

      return (
        <div
          key={violation.id}
          className={cn(
            "absolute pointer-events-auto cursor-pointer",
            "bg-yellow-200 bg-opacity-40 hover:bg-opacity-60 transition-all",
            selectedViolationId === violation.id && "ring-2 ring-blue-500 bg-blue-200"
          )}
          onClick={() => onViolationClick?.(violation.id)}
          style={{
            // These positions would need to be calculated based on actual text positions
            // For demo, using placeholder positions
            top: `${Math.random() * 70 + 10}%`,
            left: '10%',
            width: '80%',
            height: '30px'
          }}
          title={violation.type}
        >
          <div className="px-2 py-1">
            <span className="text-xs font-medium text-gray-800">
              {violation.severity}: {violation.type}
            </span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages || '...'}
          </span>
          <button
            onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* PDF Display */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center items-start p-4"
      >
        <div className="relative">
          {fileUrl && (
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              className="shadow-lg"
            >
              <Page 
                pageNumber={pageNumber}
                scale={zoom / 100}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="relative"
              />
              {/* Overlay highlights */}
              <div className="absolute inset-0 pointer-events-none">
                {renderHighlights()}
              </div>
            </Document>
          )}
        </div>
      </div>

      {/* Violation indicators */}
      {violations.length > 0 && (
        <div className="p-3 bg-white border-t">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Violations on this page:</span>
            {violations.slice(0, 3).map(v => (
              <span
                key={v.id}
                className={cn(
                  "px-2 py-1 text-xs rounded cursor-pointer",
                  v.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                  v.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700',
                  selectedViolationId === v.id && 'ring-2 ring-blue-500'
                )}
                onClick={() => onViolationClick?.(v.id)}
              >
                {v.type}
              </span>
            ))}
            {violations.length > 3 && (
              <span className="text-xs text-gray-500">+{violations.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}