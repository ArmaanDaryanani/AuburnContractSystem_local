"use client";

import React, { useState, useEffect, useRef } from "react";
import * as docx from "docx-preview";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, FileText } from "lucide-react";

interface DOCXPreviewComponentProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom?: number;
}

export function DOCXPreviewComponent({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom = 100
}: DOCXPreviewComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!containerRef.current || !file) return;
      
      setLoading(true);
      setError(null);

      try {
        // Clear the container
        containerRef.current.innerHTML = '';
        
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Render the DOCX file
        await docx.renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        // Apply zoom
        const wrapper = containerRef.current.querySelector('.docx-preview-content');
        if (wrapper) {
          (wrapper as HTMLElement).style.transform = `scale(${zoom / 100})`;
          (wrapper as HTMLElement).style.transformOrigin = 'top center';
        }

        // Add violation highlights after a short delay
        setTimeout(() => applyHighlights(), 500);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error rendering DOCX:', err);
        setError(err.message || 'Failed to render document');
        setLoading(false);
      }
    };

    loadDocument();
  }, [file, zoom]);

  const applyHighlights = () => {
    if (!containerRef.current || violations.length === 0) return;

    violations.forEach(violation => {
      if (!violation.clause || violation.clause.length < 20) return;

      // Search for text to highlight
      const searchText = violation.clause.substring(0, 100).toLowerCase();
      const walker = document.createTreeWalker(
        containerRef.current!,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip script and style nodes
            const parent = node.parentElement;
            if (parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      let found = false;
      while (node = walker.nextNode()) {
        if (found) break;
        
        const text = node.nodeValue?.toLowerCase() || '';
        const index = text.indexOf(searchText.substring(0, 50));
        
        if (index !== -1 && node.parentNode) {
          const span = document.createElement('span');
          span.className = cn(
            'violation-highlight',
            violation.severity === 'CRITICAL' ? 'highlight-critical' :
            violation.severity === 'HIGH' ? 'highlight-high' :
            violation.severity === 'MEDIUM' ? 'highlight-medium' :
            'highlight-low',
            selectedViolationId === violation.id && 'highlight-selected'
          );
          span.setAttribute('data-violation-id', violation.id);
          span.title = `${violation.type}: ${violation.description}`;
          span.onclick = () => onViolationClick?.(violation.id);
          
          // Wrap the found text
          const originalText = (node.nodeValue || '');
          const before = originalText.substring(0, index);
          const match = originalText.substring(index, index + 50);
          const after = originalText.substring(index + 50);
          
          const parent = node.parentNode;
          
          if (before) {
            parent.insertBefore(document.createTextNode(before), node);
          }
          
          span.textContent = match;
          parent.insertBefore(span, node);
          
          if (after) {
            node.nodeValue = after;
          } else {
            parent.removeChild(node);
          }
          
          found = true;
        }
      }
    });
  };

  // Update highlights when selection changes
  useEffect(() => {
    if (!containerRef.current) return;

    const highlights = containerRef.current.querySelectorAll('.violation-highlight');
    highlights.forEach(el => {
      const violationId = el.getAttribute('data-violation-id');
      if (violationId === selectedViolationId) {
        el.classList.add('highlight-selected');
      } else {
        el.classList.remove('highlight-selected');
      }
    });
  }, [selectedViolationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Failed to load document</p>
          <p className="text-xs text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-white">
      {/* Violation indicators */}
      {violations.length > 0 && (
        <div className="sticky top-0 left-0 right-0 z-10 p-3 bg-white/95 backdrop-blur border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600 font-medium">Click to highlight:</span>
            {violations.slice(0, 5).map(v => (
              <button
                key={v.id}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-all font-medium",
                  v.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                  v.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                  v.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                  'bg-blue-100 text-blue-700 hover:bg-blue-200',
                  selectedViolationId === v.id && 'ring-2 ring-blue-500'
                )}
                onClick={() => {
                  onViolationClick?.(v.id);
                  const element = containerRef.current?.querySelector(`[data-violation-id="${v.id}"]`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                title={v.description}
              >
                {v.type}
              </button>
            ))}
            {violations.length > 5 && (
              <span className="text-xs text-gray-500">+{violations.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Document container */}
      <div 
        ref={containerRef}
        className="docx-preview-container p-8"
        style={{ minHeight: '600px' }}
      />

      {/* Styles for the document and highlights */}
      <style jsx global>{`
        .docx-preview-container {
          font-family: 'Times New Roman', serif;
          line-height: 1.5;
          color: #000;
        }

        .docx-preview-content {
          max-width: 816px;
          margin: 0 auto;
          background: white;
          padding: 72px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        .docx-preview-content p {
          margin: 0 0 12px 0;
        }

        .docx-preview-content h1,
        .docx-preview-content h2,
        .docx-preview-content h3 {
          font-weight: bold;
          margin: 24px 0 12px 0;
        }

        .docx-preview-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 12px 0;
        }

        .docx-preview-content td,
        .docx-preview-content th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        .docx-preview-content ul,
        .docx-preview-content ol {
          margin: 12px 0;
          padding-left: 36px;
        }

        .docx-preview-content li {
          margin: 6px 0;
        }

        /* Page breaks */
        .docx-preview-content .docx-page-break {
          page-break-after: always;
          break-after: page;
          height: 0;
          margin: 48px 0;
          border-top: 1px dashed #ccc;
        }

        /* Violation highlights */
        .violation-highlight {
          position: relative;
          padding: 2px 4px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .highlight-critical {
          background-color: rgba(239, 68, 68, 0.2);
        }
        .highlight-critical:hover {
          background-color: rgba(239, 68, 68, 0.3);
        }

        .highlight-high {
          background-color: rgba(251, 146, 60, 0.2);
        }
        .highlight-high:hover {
          background-color: rgba(251, 146, 60, 0.3);
        }

        .highlight-medium {
          background-color: rgba(250, 204, 21, 0.2);
        }
        .highlight-medium:hover {
          background-color: rgba(250, 204, 21, 0.3);
        }

        .highlight-low {
          background-color: rgba(59, 130, 246, 0.2);
        }
        .highlight-low:hover {
          background-color: rgba(59, 130, 246, 0.3);
        }

        .highlight-selected {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}