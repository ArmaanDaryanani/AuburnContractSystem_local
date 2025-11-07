"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './pdf-viewer-paginated.css';

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

const normalizeText = (s: string) =>
  s
    .replace(/\u00AD/g, '')
    .replace(/[‐-‒–—]/g, '-')
    .replace(/[ﬁ]/g, 'fi')
    .replace(/[ﬂ]/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();

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
  const pageTextsRef = useRef<string[]>([]);
  const pageByViolationIdRef = useRef<Map<string, number>>(new Map());

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

  const onRenderSuccess = useCallback(() => {
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

        const pageTexts: string[] = [];
        let allText = "";
        const num = pdf.numPages;
        
        for (let p = 1; p <= num; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const pageText = content.items.map((i: any) => i.str).join(" ");
          pageTexts.push(pageText);
          allText += pageText + "\n";
        }

        pageTextsRef.current = pageTexts;

        const pageBuffers = pageTexts.map(normalizeText);
        const pageByViolationId = new Map<string, number>();

        violations.forEach(v => {
          const t = normalizeText(v.problematicText || '');
          if (!t || t === 'MISSING_CLAUSE') return;

          const pageIdx = pageBuffers.findIndex(pg => 
            pg.toLowerCase().includes(t.toLowerCase())
          );
          
          if (pageIdx !== -1) {
            pageByViolationId.set(v.id, pageIdx + 1);
            console.log(`✅ Found violation "${v.id}" on page ${pageIdx + 1}`);
          } else {
            console.log(`⚠️ Violation "${v.id}" not found in PDF text:`, t.substring(0, 50));
          }
        });
        
        pageByViolationIdRef.current = pageByViolationId;

        if (onTextExtracted) {
          onTextExtracted(allText);
        }
      } catch (err) {
        console.error("Error extracting PDF text:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [file, onTextExtracted, violations]);

  useEffect(() => {
    if (!pdfUrl || violationCount === 0 || tokens.length === 0) return;
    
    const highlightTimeout = setTimeout(() => {
      const pageEl = document.querySelector(
        `.react-pdf__Page[data-page-number="${currentPage}"]`
      ) as HTMLElement | null;
      const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
      
      if (!textLayer) {
        console.log(`⚠️ No text layer on page ${currentPage} (may be image/scan)`);
        return;
      }
      
      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
      
      spans.forEach(s => s.classList.remove('pdf-highlight'));
      
      const spanNorms = spans.map(s => normalizeText(s.textContent || ''));
      const pageNorm = spanNorms.join(' ');
      
      tokens.forEach(token => {
        if (!token || token.length < 10) return;
        
        const tokenNorm = normalizeText(token);
        const pageLower = pageNorm.toLowerCase();
        const tokenLower = tokenNorm.toLowerCase();
        
        const idx = pageLower.indexOf(tokenLower);
        if (idx === -1) return;
        
        let acc = 0;
        let startSpan = -1;
        let endSpan = -1;
        
        for (let i = 0; i < spanNorms.length; i++) {
          const seg = spanNorms[i];
          const segEnd = acc + seg.length;
          
          if (startSpan === -1 && segEnd > idx) startSpan = i;
          if (startSpan !== -1 && segEnd >= idx + tokenNorm.length) {
            endSpan = i;
            break;
          }
          acc = segEnd + 1;
        }
        
        if (startSpan !== -1 && endSpan !== -1) {
          for (let i = startSpan; i <= endSpan; i++) {
            spans[i].classList.add('pdf-highlight');
          }
          console.log(`✨ Highlighted spans ${startSpan}-${endSpan} on page ${currentPage}`);
        }
      });
    }, 500);
    
    return () => clearTimeout(highlightTimeout);
  }, [pdfUrl, currentPage, violationCount, tokens, renderTick, zoom]);

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
              onRenderSuccess={onRenderSuccess}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
