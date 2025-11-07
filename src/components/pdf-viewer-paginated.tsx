"use client";

import React, { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { FileText, Loader2 } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

interface PDFViewerPaginatedProps {
  file: File;
  violations: ViolationDetail[];
  zoom?: number;
  currentPage: number;
  showSinglePage: boolean;
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  onTextExtracted?: (text: string) => void;
}

export function PDFViewerPaginated({
  file,
  violations,
  zoom = 100,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange,
  onTextExtracted
}: PDFViewerPaginatedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");

  useEffect(() => {
    // Set worker path
    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
  }, []);

  useEffect(() => {
    if (!file) return;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        onTotalPagesChange(pdf.numPages);

        // Extract all text from PDF
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }

        setExtractedText(fullText);
        if (onTextExtracted) {
          onTextExtracted(fullText);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [file, onTotalPagesChange, onTextExtracted]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom / 100 });

        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, zoom]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[750px] bg-white rounded-lg">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-gray-700 mb-1">Loading PDF...</p>
          <p className="text-xs text-gray-500">Extracting text for analysis</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[750px] bg-white rounded-lg">
        <div className="text-center">
          <FileText className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-red-700 mb-1">Error Loading PDF</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const violationsOnPage = violations.filter(v => 
    v.type === 'PROBLEMATIC_TEXT' && v.problematicText && v.problematicText !== 'MISSING_CLAUSE'
  );

  return (
    <div className="bg-white rounded-lg p-4">
      {violationsOnPage.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-sm text-yellow-800 font-medium">
            {violationsOnPage.length} issue{violationsOnPage.length !== 1 ? 's' : ''} detected in this document
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Switch to TXT/DOCX format for text highlighting, or check the violations sidebar →
          </p>
        </div>
      )}
      
      <div className="flex justify-center">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>

      {extractedText && (
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            View extracted text ({extractedText.length} characters)
          </summary>
          <pre className="mt-2 p-2 bg-gray-50 rounded max-h-32 overflow-auto">
            {extractedText.substring(0, 500)}...
          </pre>
        </details>
      )}
    </div>
  );
}
