"use client";

import React, { useState, useEffect, useRef } from "react";
import mammoth from "mammoth";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, FileText } from "lucide-react";

interface DocxViewerPaginatedProps {
  file: File;
  violations: ViolationDetail[];
  zoom?: number;
  currentPage: number;
  showSinglePage: boolean;
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  onTextExtracted?: (text: string) => void;
  activeViolationId?: string | null;
}

export function DocxViewerPaginated({
  file,
  violations,
  zoom = 100,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange,
  onTextExtracted,
  activeViolationId
}: DocxViewerPaginatedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const convertDocument = async () => {
      console.log('Converting DOCX for pagination:', file.name);
      setLoading(true);
      setError(null);

      try {
        const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                      file.name.toLowerCase().endsWith('.docx');
        
        if (!isDocx) {
          throw new Error("Please upload a valid .docx file");
        }

        const reader = new FileReader();
        
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            console.log('Converting with mammoth...');
            
            const result = await mammoth.convertToHtml({
              arrayBuffer: arrayBuffer
            });
            
            const textResult = await mammoth.extractRawText({
              arrayBuffer: arrayBuffer
            });
            
            if (onTextExtracted && textResult.value) {
              console.log('Extracted text for analysis, length:', textResult.value.length);
              onTextExtracted(textResult.value);
            }
            
            console.log('Conversion complete, splitting into pages...');
            
            const htmlContent = result.value;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            const allElements = Array.from(tempDiv.children);
            const pageHeight = 800;
            const pages: string[] = [];
            let currentPageElements: Element[] = [];
            let currentHeight = 0;
            
            allElements.forEach(element => {
              const elementHeight = 50;
              
              if (currentHeight + elementHeight > pageHeight && currentPageElements.length > 0) {
                const pageDiv = document.createElement('div');
                currentPageElements.forEach(el => pageDiv.appendChild(el.cloneNode(true)));
                pages.push(pageDiv.innerHTML);
                currentPageElements = [];
                currentHeight = 0;
              }
              
              currentPageElements.push(element);
              currentHeight += elementHeight;
            });
            
            if (currentPageElements.length > 0) {
              const pageDiv = document.createElement('div');
              currentPageElements.forEach(el => pageDiv.appendChild(el.cloneNode(true)));
              pages.push(pageDiv.innerHTML);
            }
            
            const styledPages = pages.map(pageHtml => `
              <div class="docx-page-wrapper" style="
                font-family: 'Times New Roman', serif;
                font-size: 12pt;
                line-height: 1.5;
                color: #000;
                max-width: 100%;
                word-wrap: break-word;
              ">
                ${pageHtml}
              </div>
            `);
            
            setPages(styledPages);
            onTotalPagesChange(styledPages.length);
            setLoading(false);
            setError(null);
            
          } catch (conversionError: any) {
            console.error('Mammoth conversion error:', conversionError);
            setError(conversionError.message || 'Failed to convert document');
            setLoading(false);
          }
        };
        
        reader.onerror = () => {
          console.error('FileReader error');
          setError('Failed to read file');
          setLoading(false);
        };
        
        reader.readAsArrayBuffer(file);
        
      } catch (err: any) {
        console.error('Error processing DOCX:', err);
        setError(err.message || 'Failed to process document');
        setLoading(false);
      }
    };

    convertDocument();
  }, [file, onTotalPagesChange]);

  // Apply highlights when page changes or violations change
  useEffect(() => {
    if (!viewerRef.current || pages.length === 0 || loading) return;
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      applyHighlights();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentPage, pages, violations, loading]); // Removed activeViolationId dependency

  // Update active highlight styling when activeViolationId changes
  useEffect(() => {
    if (!viewerRef.current || !activeViolationId) return;
    
    // Update styling without removing highlights
    const allHighlights = viewerRef.current.querySelectorAll('.violation-highlight');
    allHighlights.forEach(span => {
      const highlightEl = span as HTMLElement;
      const violationId = highlightEl.getAttribute('data-violation-id');
      
      if (violationId === activeViolationId) {
        // Make this highlight active
        highlightEl.style.backgroundColor = 'rgba(255, 235, 59, 0.6)';
        highlightEl.style.border = '2px solid #fbbf24';
        highlightEl.style.fontWeight = 'bold';
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Make this highlight inactive
        highlightEl.style.backgroundColor = 'rgba(255, 235, 59, 0.2)';
        highlightEl.style.border = '';
        highlightEl.style.fontWeight = '';
      }
    });
  }, [activeViolationId]);

  const applyHighlights = () => {
    if (!viewerRef.current || !violations.length) return;
    
    console.log('Applying highlights to', violations.length, 'violations');
    
    // Check if highlights already exist
    const existingHighlights = viewerRef.current.querySelectorAll('.violation-highlight');
    if (existingHighlights.length > 0) {
      console.log('Highlights already applied, skipping');
      return;
    }
    
    // Apply highlights for each violation
    violations.forEach((violation, violationIndex) => {
      const violationId = violation.id || `${violation.type}_${violationIndex}`;
      const isActive = activeViolationId === violationId;
      
      // Build search terms
      const searchTerms: string[] = [];
      
      if (violation.clause && violation.clause.length > 10) {
        searchTerms.push(violation.clause.substring(0, 50));
      }
      
      const descLower = violation.description?.toLowerCase() || '';
      
      // Add specific search terms based on violation type
      if (descLower.includes('assignment of claims') || violation.farReference?.includes('52.232-23')) {
        searchTerms.push('assignment of claims');
        searchTerms.push('micropurchase threshold');
        searchTerms.push('exceeds the micropurchase');
      }
      
      if (violation.type?.toLowerCase().includes('payment') || descLower.includes('payment')) {
        searchTerms.push('payment');
        searchTerms.push('MIT shall not be obligated to pay');
      }
      
      if (descLower.includes('invoice')) {
        searchTerms.push('invoice');
      }
      
      if (descLower.includes('termination')) {
        searchTerms.push('termination');
        searchTerms.push('terminate');
      }
      
      // Try to find and highlight the text
      for (const searchTerm of searchTerms) {
        const found = highlightText(searchTerm, violation, violationId, isActive);
        if (found) break; // Stop after first match
      }
    });
  };

  const highlightText = (searchText: string, violation: ViolationDetail, violationId: string, isActive: boolean): boolean => {
    if (!viewerRef.current) return false;
    
    const searchLower = searchText.toLowerCase();
    const walker = document.createTreeWalker(
      viewerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const text = textNode.nodeValue || '';
      const textLower = text.toLowerCase();
      const index = textLower.indexOf(searchLower);
      
      if (index !== -1) {
        // Check if already highlighted
        if (textNode.parentElement?.classList.contains('violation-highlight')) {
          continue;
        }
        
        const matchedText = text.substring(index, index + searchText.length);
        
        // Create highlight span
        const span = document.createElement('span');
        span.className = 'violation-highlight';
        span.setAttribute('data-violation-id', violationId);
        span.textContent = matchedText;
        
        // Apply base styles
        span.style.backgroundColor = isActive ? 'rgba(255, 235, 59, 0.6)' : 'rgba(255, 235, 59, 0.2)';
        span.style.padding = '2px 4px';
        span.style.borderRadius = '3px';
        span.style.cursor = 'pointer';
        span.style.transition = 'all 0.2s ease';
        
        if (isActive) {
          span.style.border = '2px solid #fbbf24';
          span.style.fontWeight = 'bold';
        }
        
        // Split the text node
        const before = text.substring(0, index);
        const after = text.substring(index + searchText.length);
        
        const parent = textNode.parentElement;
        if (parent) {
          // Create new text nodes
          const beforeNode = document.createTextNode(before);
          const afterNode = document.createTextNode(after);
          
          // Replace original text node with new structure
          parent.insertBefore(beforeNode, textNode);
          parent.insertBefore(span, textNode);
          parent.insertBefore(afterNode, textNode);
          parent.removeChild(textNode);
          
          console.log(`Highlighted "${searchText}" for ${violation.type} - Active: ${isActive}`);
          return true;
        }
      }
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg" style={{ minHeight: '500px' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Converting document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg" style={{ minHeight: '500px' }}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Error Loading Document</p>
          <p className="text-xs text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg" style={{ minHeight: '500px' }}>
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No content to display</p>
        </div>
      </div>
    );
  }

  const renderPages = () => {
    if (showSinglePage) {
      return (
        <div className="flex justify-center">
          <div 
            className="bg-white shadow-lg rounded-lg p-12 mx-auto"
            style={{
              width: '816px',
              minHeight: '1056px',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease'
            }}
            dangerouslySetInnerHTML={{ __html: pages[currentPage - 1] || '' }}
          />
        </div>
      );
    } else {
      const leftPage = currentPage - 1;
      const rightPage = currentPage;
      
      return (
        <div className="flex justify-center gap-8">
          <div 
            className="bg-white shadow-lg rounded-lg p-12"
            style={{
              width: '408px',
              minHeight: '528px',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease'
            }}
            dangerouslySetInnerHTML={{ __html: pages[leftPage] || '' }}
          />
          {rightPage < pages.length && (
            <div 
              className="bg-white shadow-lg rounded-lg p-12"
              style={{
                width: '408px',
                minHeight: '528px',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease'
              }}
              dangerouslySetInnerHTML={{ __html: pages[rightPage] || '' }}
            />
          )}
        </div>
      );
    }
  };

  return (
    <div ref={viewerRef} className="docx-viewer-container h-full overflow-auto bg-gray-100 p-8">
      {renderPages()}
      
      <style jsx global>{`
        .violation-highlight:hover {
          background-color: rgba(255, 235, 59, 0.8) !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .docx-page-wrapper p {
          margin: 0.5em 0;
        }
        
        .docx-page-wrapper h1,
        .docx-page-wrapper h2,
        .docx-page-wrapper h3 {
          margin: 1em 0 0.5em 0;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}