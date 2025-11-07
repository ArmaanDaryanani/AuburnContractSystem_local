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
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00AD/g, '')
    .replace(/[‐-‒–—]/g, '-')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
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

  const violationCount = violations.filter(v => 
    v.problematicText && v.problematicText !== 'MISSING_CLAUSE'
  ).length;

  const tokens = Array.from(new Set(
    violations
      .map(v => normalizeText(v.problematicText || ''))
      .filter(t => t && t !== 'MISSING_CLAUSE' && t.length >= 10)
  ));

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
        console.log(`📚 Cached ${pageTexts.length} pages of text`);

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
    if (pageTextsRef.current.length === 0 || violations.length === 0) return;
    
    const pageBuffers = pageTextsRef.current.map(normalizeText);

    violations.forEach(v => {
      const t = normalizeText(v.problematicText || '');
      if (!t || t === 'MISSING_CLAUSE') return;

      const pageIdx = pageBuffers.findIndex(pg => 
        pg.toLowerCase().includes(t.toLowerCase())
      );
      
      if (pageIdx !== -1) {
        v.pageNumber = pageIdx + 1;
        console.log(`✅ Found violation "${v.id}" on page ${pageIdx + 1}:`, t.substring(0, 50));
      } else {
        console.log(`⚠️ Violation "${v.id}" not found in PDF text:`, t.substring(0, 50));
        
        const words = t.split(/\s+/).filter(w => w.length > 3);
        if (words.length >= 5) {
          const firstFiveWords = words.slice(0, 5).join(' ').toLowerCase();
          const fuzzyIdx = pageBuffers.findIndex(pg => 
            pg.toLowerCase().includes(firstFiveWords)
          );
          
          if (fuzzyIdx !== -1) {
            v.pageNumber = fuzzyIdx + 1;
            console.log(`🔍 Fuzzy match found for "${v.id}" on page ${fuzzyIdx + 1} using first 5 words`);
          } else {
            console.log(`❌ Even fuzzy match failed. First 5 words: "${firstFiveWords}"`);
            console.log(`📄 PDF page 1 sample:`, pageBuffers[0]?.substring(0, 200));
          }
        }
      }
    });
  }, [violations]);

  const runHighlight = useCallback((spans: HTMLSpanElement[]) => {
    spans.forEach(s => s.classList.remove('pdf-highlight'));
    
    const spanNorms = spans.map(s => normalizeText(s.textContent || ''));
    const nonEmpty = spanNorms.filter(seg => seg.length > 0);
    const pageNorm = nonEmpty.join(' ');
    
    tokens.forEach(token => {
      const tokenNorm = token;
      const pageLower = pageNorm.toLowerCase();
      const tokenLower = tokenNorm.toLowerCase();
      
      const idx = pageLower.indexOf(tokenLower);
      if (idx === -1) return;
      
      let acc = 0;
      let startSpan = -1;
      let endSpan = -1;
      let seen = 0;
      
      for (let i = 0; i < spanNorms.length; i++) {
        const seg = spanNorms[i];
        const segLen = seg.length;
        const segEnd = acc + segLen;
        
        if (startSpan === -1 && segEnd > idx) startSpan = i;
        if (startSpan !== -1 && segEnd >= idx + tokenNorm.length) {
          endSpan = i;
          break;
        }
        
        acc = segEnd + (segLen > 0 && seen < nonEmpty.length - 1 ? 1 : 0);
        if (segLen > 0) seen++;
      }
      
      if (startSpan !== -1 && endSpan !== -1) {
        for (let i = startSpan; i <= endSpan; i++) {
          const el = spans[i];
          el.classList.add('pdf-highlight');
          el.style.backgroundColor = 'rgba(250, 204, 21, 0.9)';
          el.style.boxShadow = '0 0 0 1px rgba(234, 179, 8, 0.4)';
          el.style.borderRadius = '2px';
        }

        const layer = spans[0].closest('.react-pdf__Page__textContent') as HTMLElement;
        if (layer) {
          layer.querySelectorAll('.pdf-highlight-box').forEach(n => n.remove());

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const layerRect = layer.getBoundingClientRect();

          for (let i = startSpan; i <= endSpan; i++) {
            const r = spans[i].getBoundingClientRect();
            minX = Math.min(minX, r.left);
            minY = Math.min(minY, r.top);
            maxX = Math.max(maxX, r.right);
            maxY = Math.max(maxY, r.bottom);
          }

          const box = document.createElement('div');
          box.className = 'pdf-highlight-box';
          box.style.left = `${minX - layerRect.left - 2}px`;
          box.style.top = `${minY - layerRect.top - 2}px`;
          box.style.width = `${(maxX - minX) + 4}px`;
          box.style.height = `${(maxY - minY) + 4}px`;
          layer.appendChild(box);

          box.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }

        console.log(`✨ Highlighted spans ${startSpan}-${endSpan} on page ${currentPage}`);
        console.log(`📍 Highlighted text:`, spans.slice(startSpan, endSpan + 1).map(s => s.textContent).join(''));
      }
    });
  }, [tokens, currentPage]);

  useEffect(() => {
    if (!pdfUrl || violationCount === 0 || tokens.length === 0) return;
    
    const pageEl = document.querySelector(
      `.react-pdf__Page[data-page-number="${currentPage}"]`
    ) as HTMLElement | null;
    const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
    
    if (!textLayer) {
      console.log(`⚠️ No text layer on page ${currentPage}`);
      return;
    }
    
    const ensureSpans = () => Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
    let spans = ensureSpans();
    
    if (spans.length === 0) {
      const mo = new MutationObserver(() => {
        spans = ensureSpans();
        if (spans.length > 0) {
          mo.disconnect();
          runHighlight(spans);
        }
      });
      mo.observe(textLayer, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    
    runHighlight(spans);
  }, [pdfUrl, currentPage, violationCount, tokens, zoom, runHighlight]);

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
