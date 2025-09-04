"use client";

import React, { useState, useEffect } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { FileText } from "lucide-react";

interface PDFViewerPaginatedProps {
  file: File;
  violations: ViolationDetail[];
  zoom?: number;
  currentPage: number;
  showSinglePage: boolean;
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
}

export function PDFViewerPaginated({
  file,
  violations,
  zoom = 100,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange
}: PDFViewerPaginatedProps) {
  useEffect(() => {
    // Placeholder: Set total pages for PDF
    // In a real implementation, you would parse the PDF to get actual page count
    onTotalPagesChange(10); // Example: 10 pages
  }, [onTotalPagesChange]);

  return (
    <div className="flex items-center justify-center h-[750px] bg-white rounded-lg">
      <div className="text-center">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">PDF Viewer</p>
        <p className="text-xs text-gray-500">
          Page {currentPage} {!showSinglePage && `- ${Math.min(currentPage + 1, 10)}`} of 10
        </p>
        <p className="text-xs text-gray-400 mt-2">
          PDF pagination coming soon
        </p>
      </div>
    </div>
  );
}