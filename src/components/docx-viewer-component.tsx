"use client";

import { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import * as docx from 'docx-preview';

interface DOCXViewerComponentProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom: number;
}

export function DOCXViewerComponent({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom
}: DOCXViewerComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!containerRef.current || !file) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Clear container
        containerRef.current.innerHTML = '';
        
        // Render DOCX with docx-preview
        await docx.renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: false,
          trimXmlDeclaration: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        // Apply zoom
        if (containerRef.current.firstChild) {
          (containerRef.current.firstChild as HTMLElement).style.transform = `scale(${zoom / 100})`;
          (containerRef.current.firstChild as HTMLElement).style.transformOrigin = 'top left';
        }

        // Add violation highlights after rendering
        setTimeout(() => addHighlights(), 100);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error rendering DOCX:', err);
        setError('Failed to render document');
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [file, zoom]);

  const addHighlights = () => {
    if (!containerRef.current) return;

    violations.forEach(violation => {
      if (!violation.clause) return;

      // Find text in document and highlight
      const walker = document.createTreeWalker(
        containerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.nodeValue || '';
        const searchText = violation.clause.substring(0, 50); // Use first 50 chars for searching
        
        if (text.includes(searchText)) {
          const span = document.createElement('span');
          span.className = cn(
            'inline-block px-1 rounded cursor-pointer transition-all',
            violation.severity === 'CRITICAL' ? 'bg-red-200 hover:bg-red-300' :
            violation.severity === 'HIGH' ? 'bg-orange-200 hover:bg-orange-300' :
            violation.severity === 'MEDIUM' ? 'bg-yellow-200 hover:bg-yellow-300' :
            'bg-blue-200 hover:bg-blue-300',
            selectedViolationId === violation.id && 'ring-2 ring-blue-500'
          );
          span.title = `${violation.type}: ${violation.description}`;
          span.onclick = () => onViolationClick?.(violation.id);
          span.setAttribute('data-violation-id', violation.id);

          // Wrap the text node with highlight
          const parent = node.parentNode;
          if (parent) {
            const textBefore = text.substring(0, text.indexOf(searchText));
            const textAfter = text.substring(text.indexOf(searchText) + searchText.length);
            
            if (textBefore) {
              parent.insertBefore(document.createTextNode(textBefore), node);
            }
            
            span.textContent = searchText;
            parent.insertBefore(span, node);
            
            if (textAfter) {
              node.nodeValue = textAfter;
            } else {
              parent.removeChild(node);
            }
          }
        }
      }
    });
  };

  // Update highlights when selection changes
  useEffect(() => {
    if (!containerRef.current) return;

    const highlights = containerRef.current.querySelectorAll('[data-violation-id]');
    highlights.forEach(highlight => {
      const violationId = highlight.getAttribute('data-violation-id');
      if (violationId === selectedViolationId) {
        highlight.classList.add('ring-2', 'ring-blue-500');
      } else {
        highlight.classList.remove('ring-2', 'ring-blue-500');
      }
    });
  }, [selectedViolationId]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Violation summary bar */}
      {violations.length > 0 && (
        <div className="p-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Issues found:</span>
            {violations.map((v, idx) => idx < 5 && (
              <button
                key={v.id}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-all",
                  v.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                  v.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                  v.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                  'bg-blue-100 text-blue-700 hover:bg-blue-200',
                  selectedViolationId === v.id && 'ring-2 ring-blue-500'
                )}
                onClick={() => {
                  onViolationClick?.(v.id);
                  // Scroll to highlight
                  const element = containerRef.current?.querySelector(`[data-violation-id="${v.id}"]`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
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

      {/* Document display */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
              <p className="text-sm text-gray-600">Loading document...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div 
          ref={containerRef} 
          className="docx-container"
          style={{
            minHeight: '100%',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        />
      </div>

      <style jsx global>{`
        .docx-preview {
          background: white;
          padding: 20px;
        }
        
        .docx-preview p {
          line-height: 1.6;
          margin: 0.5em 0;
        }
        
        .docx-preview h1,
        .docx-preview h2,
        .docx-preview h3 {
          margin: 1em 0 0.5em 0;
        }
        
        .docx-preview table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .docx-preview td,
        .docx-preview th {
          border: 1px solid #ddd;
          padding: 8px;
        }
      `}</style>
    </div>
  );
}