"use client";

import React, { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

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
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWH, setPageWH] = useState<{ w: number; h: number } | null>(null);
  const [fitWidth, setFitWidth] = useState<number>(0);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        if (!cancelled) setPageWH({ w: vp.width, h: vp.height });
      } catch (err) {
        console.error('Error getting page dimensions:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !pageWH) return;
      const containerH = containerRef.current.offsetHeight;
      const scaleToFit = containerH / pageWH.h;
      const widthAtFit = pageWH.w * scaleToFit;
      setFitWidth(widthAtFit);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pageWH]);

  const displayWidth = fitWidth ? (fitWidth * (zoom / 100)) : undefined;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onTotalPagesChange(numPages);
  };

  useEffect(() => {
    if (!file || isExtracting) return;

    const extractText = async () => {
      setIsExtracting(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        onTotalPagesChange(pdf.numPages);

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }

        if (onTextExtracted) {
          onTextExtracted(fullText);
        }
      } catch (err) {
        console.error('Error extracting PDF text:', err);
      } finally {
        setIsExtracting(false);
      }
    };

    extractText();
  }, [file, onTotalPagesChange, onTextExtracted, isExtracting]);


  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg">
        <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
      </div>
    );
  }

  const violationCount = violations.filter(v => 
    v.problematicText && v.problematicText !== 'MISSING_CLAUSE'
  ).length;

  return (
    <div className="bg-white h-full flex flex-col">
      {violationCount > 0 && (
        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 flex-shrink-0">
          <p className="text-sm text-yellow-800 font-medium">
            {violationCount} issue{violationCount !== 1 ? 's' : ''} detected
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            PDF text highlighting available - violations will be highlighted in yellow
          </p>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-gray-50">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={displayWidth}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
