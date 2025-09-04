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
}

export function DocxViewerPaginated({
  file,
  violations,
  zoom = 100,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange
}: DocxViewerPaginatedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) return;

    const convertDocument = async () => {
      console.log('Converting DOCX for pagination:', file.name);
      setLoading(true);
      setError(null);

      try {
        // Validate file type
        const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                      file.name.toLowerCase().endsWith('.docx');
        
        if (!isDocx) {
          throw new Error("Please upload a valid .docx file");
        }

        // Use FileReader to read file as ArrayBuffer
        const reader = new FileReader();
        
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            console.log('Converting with mammoth...');
            
            // Convert with mammoth
            const result = await mammoth.convertToHtml({
              arrayBuffer: arrayBuffer
            });
            
            console.log('Conversion complete, splitting into pages...');
            
            // Split content into pages
            // This is a simplified approach - in production you'd want more sophisticated pagination
            const htmlContent = result.value;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            // Extract paragraphs and group them into pages
            const elements = Array.from(tempDiv.children);
            const pageHeight = 700; // More content per page for standard dimensions
            const pageElements: string[][] = [];
            let currentPageElements: string[] = [];
            let currentHeight = 0;
            
            elements.forEach(element => {
              const elementHtml = element.outerHTML;
              // Better height estimation based on element type
              let estimatedHeight = 50; // default
              if (element.tagName === 'P') {
                estimatedHeight = Math.max(30, (element.textContent?.length || 0) * 0.4);
              } else if (element.tagName.match(/^H[1-3]$/)) {
                estimatedHeight = 60;
              } else if (element.tagName === 'TABLE') {
                estimatedHeight = 200;
              } else if (element.tagName === 'UL' || element.tagName === 'OL') {
                estimatedHeight = 40 * (element.children.length || 1);
              }
              
              if (currentHeight + estimatedHeight > pageHeight && currentPageElements.length > 0) {
                pageElements.push([...currentPageElements]);
                currentPageElements = [];
                currentHeight = 0;
              }
              
              currentPageElements.push(elementHtml);
              currentHeight += estimatedHeight;
            });
            
            if (currentPageElements.length > 0) {
              pageElements.push(currentPageElements);
            }
            
            // Create styled pages
            const styledPages = pageElements.map(pageContent => `
              <div class="docx-page-content">
                ${pageContent.join('')}
              </div>
            `);
            
            setPages(styledPages);
            onTotalPagesChange(styledPages.length);
            setLoading(false);
            setError(null);
            
            // Apply violation highlights after rendering
            setTimeout(() => applyViolationHighlights(), 500);
            
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
        
        // Read the file
        reader.readAsArrayBuffer(file);
        
      } catch (err: any) {
        console.error('Error processing DOCX:', err);
        setError(err.message || 'Failed to process document');
        setLoading(false);
      }
    };

    convertDocument();
  }, [file, onTotalPagesChange]);

  const applyViolationHighlights = () => {
    if (!viewerRef.current || !violations.length) return;

    violations.forEach(violation => {
      if (!violation.clause || violation.clause.length < 20) return;

      const searchText = violation.clause.substring(0, 50).toLowerCase();
      const walker = document.createTreeWalker(
        viewerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      let found = false;
      while ((node = walker.nextNode()) && !found) {
        const text = node.nodeValue?.toLowerCase() || '';
        const index = text.indexOf(searchText.substring(0, 40));
        
        if (index !== -1 && node.parentElement && !node.parentElement.classList.contains('violation-highlight-container')) {
          const span = document.createElement('span');
          span.className = 'violation-highlight-container';
          span.innerHTML = `
            <span class="highlighted-text violation-${violation.severity?.toLowerCase() || 'medium'}">${node.nodeValue?.substring(index, index + Math.min(100, (node.nodeValue?.length || 0) - index))}</span>
            <div class="violation-popover" id="popover-${violation.id}">
              <div class="violation-popover-content">
                <div class="violation-header">
                  <span class="violation-type">${violation.type}</span>
                  <span class="violation-severity severity-${violation.severity?.toLowerCase()}">${violation.severity}</span>
                </div>
                <p class="violation-description">${violation.description}</p>
                <div class="violation-suggestion">
                  <strong>Suggested Fix:</strong> ${violation.suggestion}
                </div>
                ${violation.farReference ? `<div class="violation-reference">FAR Reference: ${violation.farReference}</div>` : ''}
              </div>
            </div>
          `;
          
          // Add click handler
          span.onclick = (e) => {
            e.stopPropagation();
            const popover = document.getElementById(`popover-${violation.id}`);
            if (popover) {
              const isVisible = popover.style.display === 'block';
              document.querySelectorAll('.violation-popover').forEach(p => {
                (p as HTMLElement).style.display = 'none';
              });
              popover.style.display = isVisible ? 'none' : 'block';
            }
          };
          
          const originalText = node.nodeValue || '';
          const before = originalText.substring(0, index);
          const after = originalText.substring(index + Math.min(100, originalText.length - index));
          
          const parent = node.parentElement;
          
          if (before) {
            parent.insertBefore(document.createTextNode(before), node);
          }
          
          parent.insertBefore(span, node);
          
          if (after) {
            parent.insertBefore(document.createTextNode(after), node);
          }
          
          parent.removeChild(node);
          found = true;
        }
      }
    });
  };

  // Re-apply highlights when page changes
  useEffect(() => {
    if (pages.length > 0 && !loading) {
      setTimeout(() => applyViolationHighlights(), 100);
    }
  }, [currentPage, pages, violations, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg" style={{ minHeight: '500px' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Converting document...</p>
          <p className="text-xs text-gray-500 mt-2">Processing {file.name}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg" style={{ minHeight: '500px' }}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Unable to display document</p>
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

  const leftPageIndex = currentPage - 1;
  const rightPageIndex = showSinglePage ? -1 : currentPage;
  
  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Styles for pages and highlights */}
      <style jsx global>{`
        .docx-page-wrapper {
          display: flex;
          gap: 24px;
          padding: 40px 20px 20px 20px;
          justify-content: center;
          align-items: stretch;
          height: calc(100vh - 160px);
          overflow: hidden;
        }
        
        .docx-page {
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
          border-radius: 4px;
          overflow-y: auto;
          overflow-x: hidden;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        
        .docx-page-single {
          width: 850px;
          max-width: 90%;
          aspect-ratio: 8.5 / 11;
          max-height: calc(100vh - 200px);
        }
        
        .docx-page-spread {
          width: 420px;
          aspect-ratio: 8.5 / 11;
          max-height: calc(100vh - 200px);
        }
        
        .docx-page-content {
          padding: 40px;
          font-family: 'Times New Roman', Georgia, serif;
          line-height: 1.6;
          color: #000;
          font-size: 14px;
        }
        
        .docx-page-content p {
          margin: 1em 0;
          text-align: justify;
        }
        
        .docx-page-content h1, 
        .docx-page-content h2, 
        .docx-page-content h3 {
          margin: 1.5em 0 0.5em 0;
          font-weight: bold;
        }
        
        .docx-page-content h1 { font-size: 2em; }
        .docx-page-content h2 { font-size: 1.5em; }
        .docx-page-content h3 { font-size: 1.2em; }
        
        .docx-page-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .docx-page-content td, 
        .docx-page-content th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .docx-page-content ul, 
        .docx-page-content ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        
        .docx-page-content li {
          margin: 0.5em 0;
        }
        
        .highlighted-text {
          background-color: rgba(250, 204, 21, 0.3);
          border-bottom: 2px solid #f59e0b;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 3px;
          transition: all 0.2s;
        }
        
        .highlighted-text:hover {
          background-color: rgba(250, 204, 21, 0.5);
        }
        
        .violation-critical .highlighted-text,
        .highlighted-text.violation-critical {
          background-color: rgba(239, 68, 68, 0.3);
          border-bottom-color: #dc2626;
        }
        
        .violation-high .highlighted-text,
        .highlighted-text.violation-high {
          background-color: rgba(251, 146, 60, 0.3);
          border-bottom-color: #ea580c;
        }
        
        .violation-medium .highlighted-text,
        .highlighted-text.violation-medium {
          background-color: rgba(250, 204, 21, 0.3);
          border-bottom-color: #f59e0b;
        }
        
        .violation-highlight-container {
          position: relative;
          display: inline;
        }
        
        .violation-popover {
          display: none;
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          z-index: 1000;
          min-width: 350px;
          max-width: 450px;
        }
        
        .violation-popover::before {
          content: '';
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 8px solid white;
          filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.1));
        }
        
        .violation-popover-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.05);
          border: 1px solid #e5e7eb;
          padding: 16px;
        }
        
        .violation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .violation-type {
          font-weight: 600;
          font-size: 14px;
          color: #1f2937;
        }
        
        .violation-severity {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .severity-critical {
          background-color: #fef2f2;
          color: #dc2626;
        }
        
        .severity-high {
          background-color: #fff7ed;
          color: #ea580c;
        }
        
        .severity-medium {
          background-color: #fefce8;
          color: #f59e0b;
        }
        
        .violation-description {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 12px;
          line-height: 1.5;
        }
        
        .violation-suggestion {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 10px;
          font-size: 12px;
          color: #166534;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        
        .violation-suggestion strong {
          display: block;
          margin-bottom: 4px;
          color: #14532d;
        }
        
        .violation-reference {
          font-size: 11px;
          color: #6b7280;
          margin-top: 8px;
          padding: 6px;
          background-color: #f9fafb;
          border-radius: 4px;
        }
        
        .page-number {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #6b7280;
          font-family: system-ui, -apple-system, sans-serif;
        }
      `}</style>
      
      <div 
        ref={viewerRef}
        className="docx-page-wrapper"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          width: `${100 * (100 / zoom)}%`,
          height: `${100 * (100 / zoom)}%`
        }}
      >
        {showSinglePage ? (
          // Single page view
          <div className="docx-page docx-page-single">
            <div dangerouslySetInnerHTML={{ __html: pages[leftPageIndex] || '' }} />
            <div className="page-number">{currentPage}</div>
          </div>
        ) : (
          // Two-page spread view
          <>
            {leftPageIndex >= 0 && leftPageIndex < pages.length && (
              <div className="docx-page docx-page-spread">
                <div dangerouslySetInnerHTML={{ __html: pages[leftPageIndex] || '' }} />
                <div className="page-number">{currentPage}</div>
              </div>
            )}
            {rightPageIndex >= 0 && rightPageIndex < pages.length && (
              <div className="docx-page docx-page-spread">
                <div dangerouslySetInnerHTML={{ __html: pages[rightPageIndex] || '' }} />
                <div className="page-number">{currentPage + 1}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}