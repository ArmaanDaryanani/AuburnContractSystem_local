"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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
  zoom = 85,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange,
  onTextExtracted
}: PDFViewerPaginatedProps) {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const extractedOnceRef = useRef<string | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  useEffect(() => {
    let url = "";
    (async () => {
      url = URL.createObjectURL(file);
      setPdfUrl(url);
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onTotalPagesChange(numPages);
  };

  const onPageRenderSuccess = useCallback(() => {
    setRenderTick(t => t + 1);
  }, []);

  const violationCount = violations.filter(v => 
    v.problematicText && v.problematicText !== 'MISSING_CLAUSE'
  ).length;

  const tokens = violations
    ?.map(v => v.problematicText)
    .filter(Boolean)
    .filter(t => t !== 'MISSING_CLAUSE')
    .slice(0, 20) as string[];

  console.log('🎯 Tokens to highlight:', tokens);

  useEffect(() => {
    if (!file) return;
    if (extractedOnceRef.current === file.name) return;
    extractedOnceRef.current = file.name;

    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let allText = "";
        const num = pdf.numPages;
        for (let p = 1; p <= num; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          allText += content.items.map((i: any) => i.str).join(" ") + "\n";
        }

        if (onTextExtracted) {
          onTextExtracted(allText);
        }
      } catch (err) {
        console.error("Error extracting PDF text:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [file, onTextExtracted]);

  useEffect(() => {
    if (!pdfUrl || violationCount === 0 || tokens.length === 0) return;
    
    const highlightTimeout = setTimeout(() => {
      const pageEl = document.querySelector(
        `.react-pdf__Page[data-page-number="${currentPage}"]`
      ) as HTMLElement | null;
      const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
      
      if (!textLayer) {
        console.log('❌ No text layer found for page', currentPage);
        return;
      }
      
      const textSpans = Array.from(textLayer.querySelectorAll('span'));
      const fullText = textSpans.map(s => s.textContent || '').join(' ');
      
      console.log(`📄 Page ${currentPage} text length:`, fullText.length);
      
      tokens.forEach(token => {
        if (!token || token.length < 10) return;
        
        console.log('🔍 Searching for:', token.substring(0, 50) + '...');
        
        const normalizedToken = token.trim().replace(/\s+/g, ' ');
        const normalizedFullText = fullText.replace(/\s+/g, ' ');
        
        const index = normalizedFullText.toLowerCase().indexOf(normalizedToken.toLowerCase());
        
        if (index !== -1) {
          console.log('✅ Found match at index:', index);
          
          let charCount = 0;
          let startSpan = -1;
          let endSpan = -1;
          
          for (let i = 0; i < textSpans.length; i++) {
            const spanText = textSpans[i].textContent || '';
            const spanStart = charCount;
            const spanEnd = charCount + spanText.length;
            
            if (startSpan === -1 && spanEnd > index) {
              startSpan = i;
            }
            
            if (startSpan !== -1 && spanEnd >= index + normalizedToken.length) {
              endSpan = i;
              break;
            }
            
            charCount += spanText.length + 1;
          }
          
          if (startSpan !== -1 && endSpan !== -1) {
            for (let i = startSpan; i <= endSpan; i++) {
              (textSpans[i] as HTMLSpanElement).style.backgroundColor = 'rgba(254, 240, 138, 0.8)';
              (textSpans[i] as HTMLSpanElement).style.borderRadius = '2px';
              (textSpans[i] as HTMLSpanElement).style.padding = '2px 1px';
            }
            console.log(`✨ Highlighted spans ${startSpan} to ${endSpan} on page ${currentPage}`);
          }
        } else {
          console.log(`❌ No match found on page ${currentPage}`);
        }
      });
    }, 500);
    
    return () => clearTimeout(highlightTimeout);
  }, [pdfUrl, currentPage, violationCount, tokens, renderTick]);

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg">
        <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col overflow-hidden">
      {violationCount > 0 && (
        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 flex-shrink-0">
          <p className="text-sm text-yellow-800 font-medium">
            {violationCount} issue{violationCount !== 1 ? 's' : ''} detected
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Violations highlighted in yellow
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <div className="flex items-start justify-center">
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
              scale={zoom / 100}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onRenderSuccess={onPageRenderSuccess}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
