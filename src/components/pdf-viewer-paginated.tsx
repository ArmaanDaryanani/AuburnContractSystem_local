"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { PAGE_JOINER } from "@/lib/text-joiner";
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
  const pageTextsRef = useRef<string[]>([]);
  const pageItemStringsRef = useRef<string[][]>([]);
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

  const violationCount = violations.filter(v => 
    v.problematicText && v.problematicText !== 'MISSING_CLAUSE'
  ).length;

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
        const pageItemStrings: string[][] = [];
        const num = pdf.numPages;
        
        for (let p = 1; p <= num; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const items = content.items.map((i: any) => i.str);
          pageItemStrings.push(items);
          const pageText = items.join(" ");
          pageTexts.push(pageText);
        }

        pageTextsRef.current = pageTexts;
        pageItemStringsRef.current = pageItemStrings;
        
        // Build ranges immediately after extraction (Fix #4)
        let acc = 0;
        const ranges = pageTexts.map(pageText => {
          const start = acc;
          const end = acc + pageText.length;
          acc = end + PAGE_JOINER.length;
          return { start, end };
        });
        rangesRef.current = ranges;
        
        const allText = pageTexts.join(PAGE_JOINER);
        console.log(`📚 Cached ${pageTexts.length} pages of text (total: ${allText.length} chars)`);

        if (onTextExtracted) {
          onTextExtracted(allText);
        }
      } catch (err) {
        console.error("Error extracting PDF text:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [file, onTextExtracted]);

  const rangesRef = useRef<Array<{start: number, end: number}>>([]);
  
  // Map violations to pages using binary search (Fix #4: now depends only on violations, ranges built during extraction)
  useEffect(() => {
    if (rangesRef.current.length === 0 || violations.length === 0) return;
    
    const ranges = rangesRef.current;

    violations.forEach(v => {
      if (!v.problematicText || v.problematicText === 'MISSING_CLAUSE') return;
      
      // Fix #1: Don't treat 0 as falsy
      if (typeof v.start !== 'number' || typeof v.end !== 'number') return;
      
      // Binary search to find which page contains this index
      let lo = 0, hi = ranges.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const { start, end } = ranges[mid];
        if (v.start < start) hi = mid - 1;
        else if (v.start >= end) lo = mid + 1;
        else {
          v.pageNumber = mid + 1; // Convert to 1-based
          console.log(`✅ Mapped violation "${v.id}" to page ${mid + 1} using index ${v.start}-${v.end}`);
          return;
        }
      }
      // Fix #8: Better logging with max range
      console.warn(`⚠️ Index ${v.start}..${v.end} out of range for "${v.id}" (0..${ranges[ranges.length-1]?.end})`);
    });
  }, [violations]);

  const runHighlight = useCallback((spans: HTMLSpanElement[], pageIdx: number) => {
    spans.forEach(s => s.classList.remove('pdf-highlight'));
    
    const ranges = rangesRef.current;
    if (ranges.length === 0) return;
    
    const { start: gStart, end: gEnd } = ranges[pageIdx];
    
    // Find violations that overlap with this page (Fix #1: typeof checks)
    const pageViolations = violations.filter(v => {
      if (typeof v.start !== 'number' || typeof v.end !== 'number') return false;
      if (v.problematicText === 'MISSING_CLAUSE') return false;
      // Check if violation overlaps with this page
      return v.start < gEnd && v.end > gStart;
    });
    
    if (pageViolations.length === 0) return;
    
    // Fix #3 Option A: Build offsets from same string used for pageTextsRef
    const pageText = pageTextsRef.current[pageIdx] || '';
    let acc = 0;
    const spanOffsets = spans.map(s => {
      const text = s.textContent || '';
      const start = acc;
      const end = acc + text.length;
      acc = end; // Fix #2: No synthetic +1 space
      return { start, end };
    });
    
    let firstHighlightedSpan: HTMLSpanElement | undefined = undefined;
    
    pageViolations.forEach(v => {
      // Compute local offsets within this page
      const localStart = Math.max(0, v.start! - gStart);
      const localEnd = Math.min(pageText.length, v.end! - gStart);
      
      if (localEnd <= localStart) return;
      
      // Fix #5: Explicit and clearer span selection
      let startSpan = -1, endSpan = -1;
      for (let i = 0; i < spanOffsets.length; i++) {
        const { start, end } = spanOffsets[i];
        if (end > localStart && startSpan === -1) startSpan = i;    // first overlap
        if (start < localEnd) endSpan = i;                          // extend while overlapping
      }
      
      if (startSpan === -1 || endSpan === -1) return;
      
      // Highlight the spans
      for (let i = startSpan; i <= endSpan; i++) {
        const el = spans[i];
        el.classList.add('pdf-highlight');
        el.style.backgroundColor = 'rgba(250, 204, 21, 0.9)';
        el.style.boxShadow = '0 0 0 1px rgba(234, 179, 8, 0.4)';
        el.style.borderRadius = '2px';
        
        // Track first highlighted span for scroll (Fix #6)
        if (!firstHighlightedSpan) firstHighlightedSpan = el;
      }
      
      console.log(`✨ Highlighted spans ${startSpan}-${endSpan} on page ${pageIdx + 1} for violation "${v.id}"`);
    });
    
    // Fix #6: Gentle auto-scroll to first highlighted span
    if (firstHighlightedSpan) {
      (firstHighlightedSpan as HTMLSpanElement).scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }, [violations]);

  useEffect(() => {
    console.log('🎨 Highlight effect triggered:', {
      pdfUrl: !!pdfUrl,
      currentPage,
      violationCount,
      rangesLength: rangesRef.current.length,
      violations: violations.length
    });
    
    if (!pdfUrl || violationCount === 0 || rangesRef.current.length === 0) {
      console.log('⏸️ Skipping highlight:', { noPdfUrl: !pdfUrl, noViolations: violationCount === 0, noRanges: rangesRef.current.length === 0 });
      return;
    }
    
    const pageEl = document.querySelector(
      `.react-pdf__Page[data-page-number="${currentPage}"]`
    ) as HTMLElement | null;
    const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
    
    if (!textLayer) {
      console.log(`⚠️ No text layer on page ${currentPage}`);
      return;
    }
    
    const pageIdx = currentPage - 1; // Convert to 0-based index
    const ensureSpans = () => Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
    let spans = ensureSpans();
    
    console.log(`📄 Page ${currentPage}: Found ${spans.length} spans`);
    
    if (spans.length === 0) {
      console.log('⏳ Waiting for spans to populate via MutationObserver');
      const mo = new MutationObserver(() => {
        spans = ensureSpans();
        if (spans.length > 0) {
          console.log(`✅ Spans populated: ${spans.length} spans`);
          mo.disconnect();
          runHighlight(spans, pageIdx);
        }
      });
      mo.observe(textLayer, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    
    console.log(`▶️ Calling runHighlight for page ${currentPage} with ${spans.length} spans`);
    runHighlight(spans, pageIdx);
  }, [pdfUrl, currentPage, violationCount, zoom, runHighlight, violations]);

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
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
