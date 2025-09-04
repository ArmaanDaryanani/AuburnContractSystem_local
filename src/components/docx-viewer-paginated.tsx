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
}

export function DocxViewerPaginated({
  file,
  violations,
  zoom = 100,
  currentPage,
  showSinglePage,
  onPageChange,
  onTotalPagesChange,
  onTextExtracted
}: DocxViewerPaginatedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Add escape key listener to close modal
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('violation-modal');
        if (modal) {
          modal.remove();
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

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
            
            // Also extract plain text for analysis
            const textResult = await mammoth.extractRawText({
              arrayBuffer: arrayBuffer
            });
            
            // Pass extracted text to parent for analysis
            if (onTextExtracted && textResult.value) {
              console.log('Extracted text for analysis, length:', textResult.value.length);
              onTextExtracted(textResult.value);
            }
            
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
            setTimeout(() => applyViolationHighlights(), 200);
            
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

  // Re-apply highlights when violations change - optimize by only when necessary
  useEffect(() => {
    if (pages.length > 0 && violations.length > 0 && !loading) {
      // Delay slightly to ensure DOM is ready
      const timer = setTimeout(() => {
        applyViolationHighlights();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [violations.length, pages.length, loading]); // Only re-run when counts change, not on every page change

  const applyViolationHighlights = () => {
    if (!viewerRef.current || !violations.length) return;

    console.log('Applying highlights to', violations.length, 'violations on page', currentPage);
    
    // Clear existing highlights first
    const existingHighlights = viewerRef.current.querySelectorAll('.violation-highlight-container');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      const text = el.textContent || '';
      if (parent) {
        parent.replaceChild(document.createTextNode(text), el);
      }
    });
    
    // Track which violations have been highlighted to avoid duplicates
    const highlightedViolations = new Set<string>();
    
    violations.forEach(violation => {
      // Skip if already highlighted
      if (highlightedViolations.has(violation.id || violation.type || '')) {
        return;
      }
      
      // Try to find text to highlight - use clause, problematicText, or description keywords
      let searchTexts = [];
      
      // Check what fields are available
      console.log('Looking for violation:', violation.type, violation.severity, 'on page', currentPage);
      
      if ((violation as any).problematicText) {
        // Use only the first 50 chars to avoid partial matches
        const text = (violation as any).problematicText;
        searchTexts.push(text.substring(0, Math.min(50, text.length)));
      }
      
      if (violation.clause && violation.clause.length > 10) {
        searchTexts.push(violation.clause.substring(0, 50));
      }
      
      // Add specific keywords based on violation type and description
      if (violation.type?.toLowerCase().includes('payment') || violation.description?.toLowerCase().includes('payment')) {
        searchTexts.push('ten (10) business days');
        searchTexts.push('payment terms');
        searchTexts.push('payment will be made ten');
        searchTexts.push('receiving payment from');
        searchTexts.push("Company's payment terms");
        searchTexts.push('10) business days of receiving payment');
        searchTexts.push('invoice');
      }
      if (violation.type?.toLowerCase().includes('indemnif')) {
        searchTexts.push('indemnify');
        searchTexts.push('indemnification');
        searchTexts.push('hold harmless');
      }
      if (violation.type?.toLowerCase().includes('termination') || violation.description?.toLowerCase().includes('termination')) {
        searchTexts.push('termination');
        searchTexts.push('terminate');
        searchTexts.push('Termination for Convenience');
        searchTexts.push('issuance of Task Orders');
        searchTexts.push('Task Orders');
      }
      // Look for other specific terms from the descriptions
      if (violation.description?.toLowerCase().includes('grant')) {
        searchTexts.push('grant');
        searchTexts.push('rights');
        searchTexts.push('Company');
      }
      if (violation.description?.toLowerCase().includes('article')) {
        searchTexts.push('Article IX');
        searchTexts.push('ARTICLE IX');
        searchTexts.push('ARTICLE');
      }
      // For medium/low severity - look for more generic terms
      if (violation.severity?.toLowerCase() === 'medium' || violation.severity?.toLowerCase() === 'low') {
        if (violation.description?.toLowerCase().includes('incorporate')) {
          searchTexts.push('incorporate');
          searchTexts.push('FAR');
          searchTexts.push('flowdown');
        }
        if (violation.description?.toLowerCase().includes('personnel')) {
          searchTexts.push('key subcontractor personnel');
          searchTexts.push('personnel');
        }
        if (violation.description?.toLowerCase().includes('written')) {
          searchTexts.push('written');
          searchTexts.push('email');
          searchTexts.push('electronic');
          searchTexts.push('invoices');
        }
        if (violation.description?.toLowerCase().includes('invoice')) {
          searchTexts.push('invoice');
          searchTexts.push('invoices');
          searchTexts.push('email');
          searchTexts.push('submitted via email');
        }
        // Extract key phrases from description - but shorter to avoid overlaps
        const descWords = violation.description?.split(' ').slice(2, 5).join(' ');
        if (descWords && descWords.length > 10) {
          searchTexts.push(descWords);
        }
      }

      const walker = document.createTreeWalker(
        viewerRef.current!,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip text nodes inside violation popovers
            const parent = node.parentElement;
            if (parent?.closest('.violation-popover-content') || 
                parent?.closest('.violation-popover')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      let found = false;
      
      while ((node = walker.nextNode()) && !found) {
        const nodeText = node.nodeValue || '';
        const nodeTextLower = nodeText.toLowerCase();
        
        // Skip if this text node is already part of a highlight
        if (node.parentElement?.classList.contains('highlighted-text') || 
            node.parentElement?.parentElement?.classList.contains('violation-highlight-container')) {
          continue;
        }
        
        for (const searchText of searchTexts) {
          const searchLower = searchText.toLowerCase();
          const index = nodeTextLower.indexOf(searchLower);
        
          if (index !== -1 && node.parentElement && !node.parentElement.classList.contains('violation-highlight-container')) {
            console.log('Found match for violation:', violation.type, 'at:', searchText);
            const span = document.createElement('span');
            span.className = 'violation-highlight-container';
            
            // Extract the matched text
            const matchLength = Math.min(searchLower.length, nodeText.length - index);
            const matchedText = nodeText.substring(index, index + matchLength);
            
            // Create unique ID for this specific highlight
            const uniqueId = `${violation.id || violation.type}_${index}_${Date.now()}`;
            span.setAttribute('data-violation-id', violation.id || violation.type || '');
            span.setAttribute('data-violation-index', index.toString());
            
            span.innerHTML = `
              <span class="highlighted-text violation-${violation.severity?.toLowerCase() || 'medium'}">${matchedText}</span>
            `;
          
            // Add click handler to show modal
            span.onclick = (e) => {
              e.stopPropagation();
              
              // Remove any existing modal
              const existingModal = document.getElementById('violation-modal');
              if (existingModal) {
                existingModal.remove();
              }
              
              // Create modal overlay
              const modal = document.createElement('div');
              modal.id = 'violation-modal';
              modal.className = 'violation-modal-overlay';
              modal.innerHTML = `
                <div class="violation-modal-content">
                  <button class="violation-modal-close" onclick="document.getElementById('violation-modal').remove()">×</button>
                  <div class="violation-modal-header">
                    <span class="violation-type">${violation.type}</span>
                    <span class="violation-severity severity-${violation.severity?.toLowerCase()}">${violation.severity}</span>
                  </div>
                  <p class="violation-modal-description">${violation.description}</p>
                  <div class="violation-modal-suggestion">
                    <strong>Suggested Fix:</strong>
                    <p>${violation.suggestion}</p>
                  </div>
                  ${violation.farReference ? `<div class="violation-modal-reference">FAR Reference: ${violation.farReference}</div>` : ''}
                  <div class="violation-modal-hint">Click × or press ESC to close</div>
                </div>
              `;
              
              document.body.appendChild(modal);
              
              // Close on overlay click
              modal.onclick = (e) => {
                if (e.target === modal) {
                  modal.remove();
                }
              };
            };
            
            const originalText = node.nodeValue || '';
            const before = originalText.substring(0, index);
            const after = originalText.substring(index + matchLength);
            
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
            // Mark this violation as highlighted to avoid duplicates
            highlightedViolations.add(violation.id || violation.type || '');
            break; // Exit the search loop once found
          }
        }
      }
    });
  };

  // Re-apply highlights when page changes - optimized
  useEffect(() => {
    if (pages.length > 0 && !loading && violations.length > 0) {
      // Delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        applyViolationHighlights();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage, loading, violations]); // Added violations to dependencies

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
          width: 100%;
          max-width: 1100px;
          min-width: 900px;
          height: calc(100vh - 220px);
        }
        
        .docx-page-spread {
          width: 48%;
          max-width: 540px;
          min-width: 450px;
          height: calc(100vh - 220px);
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
          background-color: rgba(250, 204, 21, 0.25);
          border-bottom: 2px solid #f59e0b;
          cursor: pointer;
          padding: 1px 2px;
          border-radius: 2px;
        }
        
        .highlighted-text:hover {
          background-color: rgba(250, 204, 21, 0.35);
        }
        
        .violation-critical .highlighted-text,
        .highlighted-text.violation-critical {
          background-color: rgba(239, 68, 68, 0.2);
          border-bottom-color: #dc2626;
        }
        
        .violation-high .highlighted-text,
        .highlighted-text.violation-high {
          background-color: rgba(251, 146, 60, 0.2);
          border-bottom-color: #ea580c;
        }
        
        .violation-medium .highlighted-text,
        .highlighted-text.violation-medium {
          background-color: rgba(250, 204, 21, 0.25);
          border-bottom-color: #f59e0b;
        }
        
        .violation-low .highlighted-text,
        .highlighted-text.violation-low {
          background-color: rgba(59, 130, 246, 0.2);
          border-bottom-color: #3b82f6;
        }
        
        .violation-highlight-container {
          position: relative;
          display: inline;
          cursor: pointer;
        }
        
        /* Modal Overlay Styles */
        .violation-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .violation-modal-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          position: relative;
          animation: slideUp 0.2s ease;
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .violation-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 28px;
          color: #6b7280;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }
        
        .violation-modal-close:hover {
          background: #f3f4f6;
        }
        
        .violation-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .violation-modal-description {
          font-size: 14px;
          color: #4b5563;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        
        .violation-modal-suggestion {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .violation-modal-suggestion strong {
          display: block;
          margin-bottom: 8px;
          color: #14532d;
          font-size: 14px;
        }
        
        .violation-modal-suggestion p {
          color: #166534;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }
        
        .violation-modal-reference {
          font-size: 12px;
          color: #6b7280;
          padding: 10px;
          background-color: #f9fafb;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        
        .violation-modal-hint {
          font-size: 11px;
          color: #9ca3af;
          text-align: center;
          margin-top: 16px;
          font-style: italic;
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
        
        .violation-dismiss-hint {
          font-size: 10px;
          color: #9ca3af;
          text-align: center;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid #f3f4f6;
          font-style: italic;
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