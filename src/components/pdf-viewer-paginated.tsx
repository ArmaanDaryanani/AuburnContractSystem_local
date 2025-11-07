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
  const pageItemOffsetsRef = useRef<Array<Array<{start: number, end: number}>>>([]);
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
        const pageItemOffsets: Array<Array<{start: number, end: number}>> = [];
        const num = pdf.numPages;
        
        for (let p = 1; p <= num; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const items = content.items.map((i: any) => i.str);
          pageItemStrings.push(items);
          
          // Build authoritative item offsets using SAME join rule as pageText
          let itemAcc = 0;
          const itemOffsets = items.map(str => {
            const start = itemAcc;
            const end = start + str.length;
            itemAcc = end + 1; // +1 for the space in join(' ')
            return { start, end };
          });
          pageItemOffsets.push(itemOffsets);
          
          const pageText = items.join(" ");
          pageTexts.push(pageText);
        }

        pageTextsRef.current = pageTexts;
        pageItemStringsRef.current = pageItemStrings;
        pageItemOffsetsRef.current = pageItemOffsets;
        
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
          v.pageNumber = mid + 1;
          return;
        }
      }
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
    
    // Get authoritative data built during extraction
    const items = pageItemStringsRef.current[pageIdx] || [];
    const itemOffsets = pageItemOffsetsRef.current[pageIdx] || [];
    const pageText = pageTextsRef.current[pageIdx] || '';
    
    console.log(`📊 Page ${pageIdx + 1}: items=${items.length}, spans=${spans.length}`);
    
    let firstHighlightedSpan: HTMLSpanElement | undefined = undefined;
    
    pageViolations.forEach(v => {
      // Compute local offsets within this page
      const localStart = Math.max(0, v.start! - gStart);
      const localEnd = Math.min(pageText.length, v.end! - gStart);
      
      console.log(`🔍 Violation "${v.id}":`, {
        global: `${v.start}-${v.end}`,
        pageRange: `${gStart}-${gEnd}`,
        local: `${localStart}-${localEnd}`,
        pageTextLength: pageText.length,
        snippet: pageText.slice(localStart, localEnd).substring(0, 100)
      });
      
      if (localEnd <= localStart) {
        console.log(`❌ Skipping "${v.id}" - empty range`);
        return;
      }
      
      // Find which items overlap [localStart, localEnd)
      const itemIndices: number[] = [];
      for (let i = 0; i < itemOffsets.length; i++) {
        const { start, end } = itemOffsets[i];
        if (end > localStart && start < localEnd) {
          itemIndices.push(i);
        }
      }
      
      console.log(`🎯 Violation "${v.id}": found ${itemIndices.length} items [${itemIndices.slice(0, 10).join(', ')}${itemIndices.length > 10 ? '...' : ''}]`);
      
      if (itemIndices.length === 0) {
        console.log(`❌ No items found for "${v.id}"`);
        console.log(`Debug: itemOffsets range:`, itemOffsets[0], '...', itemOffsets[itemOffsets.length - 1]);
        return;
      }
      
      // Highlight corresponding spans by index
      let highlighted = 0;
      for (const i of itemIndices) {
        const el = spans[i];
        if (!el) {
          console.warn(`⚠️ Span ${i} not found for item`);
          continue;
        }
        
        el.classList.add('pdf-highlight');
        el.style.backgroundColor = 'rgba(250, 204, 21, 0.9)';
        el.style.boxShadow = '0 0 0 1px rgba(234, 179, 8, 0.4)';
        el.style.borderRadius = '2px';
        el.setAttribute('data-violation-id', v.id);
        
        if (!firstHighlightedSpan) firstHighlightedSpan = el;
        highlighted++;
      }
      
      console.log(`✨ Highlighted ${highlighted} spans on page ${pageIdx + 1} for violation "${v.id}"`);
    });
    
    // Fix #6: Gentle auto-scroll to first highlighted span
    if (firstHighlightedSpan) {
      (firstHighlightedSpan as HTMLSpanElement).scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  }, [violations]);

  useEffect(() => {
    if (!pdfUrl || violationCount === 0 || rangesRef.current.length === 0) {
      return;
    }
    
    // Retry multiple times with increasing delays to catch async text layer rendering
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryHighlight = () => {
      attempts++;
      
      const pageEl = document.querySelector(
        `.react-pdf__Page[data-page-number="${currentPage}"]`
      ) as HTMLElement | null;
      const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
      
      if (!textLayer) {
        if (attempts < maxAttempts) {
          setTimeout(tryHighlight, 50 * attempts);
        }
        return;
      }
      
      const pageIdx = currentPage - 1;
      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
      
      if (spans.length === 0 && attempts < maxAttempts) {
        setTimeout(tryHighlight, 50 * attempts);
        return;
      }
      
      if (spans.length > 0) {
        console.log(`✅ Page ${currentPage}: Found ${spans.length} spans, highlighting...`);
        runHighlight(spans, pageIdx);
      }
    };
    
    tryHighlight();
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
