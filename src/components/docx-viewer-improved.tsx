"use client";

import { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, FileText } from "lucide-react";

interface DOCXViewerImprovedProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom: number;
}

export function DOCXViewerImproved({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom
}: DOCXViewerImprovedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");

  useEffect(() => {
    const loadDocument = async () => {
      if (!file) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // First try to get the HTML content from the extraction API
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/documents/extract-text', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to extract document: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.html) {
          // Use the HTML content if available
          setDocumentContent(result.html);
        } else if (result.text) {
          // Fallback to plain text with basic formatting
          const formattedText = result.text
            .split('\n\n')
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
          setDocumentContent(formattedText);
        } else {
          throw new Error('No content extracted from document');
        }
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading DOCX:', err);
        setError(err.message || 'Failed to load document');
        setIsLoading(false);
        
        // Try a basic file read as last resort
        try {
          const text = await file.text();
          if (text) {
            const basicHtml = text
              .split('\n\n')
              .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
              .join('');
            setDocumentContent(basicHtml);
            setError(null);
          }
        } catch (textErr) {
          console.error('Failed to read file as text:', textErr);
        }
      }
    };

    loadDocument();
  }, [file]);

  // Apply zoom effect
  useEffect(() => {
    if (containerRef.current && documentContent) {
      containerRef.current.style.transform = `scale(${zoom / 100})`;
      containerRef.current.style.transformOrigin = 'top left';
      
      // Apply highlights after content is rendered
      setTimeout(() => applyHighlights(), 100);
    }
  }, [documentContent, zoom, violations, selectedViolationId]);

  const applyHighlights = () => {
    if (!containerRef.current || violations.length === 0) return;

    // Remove existing highlights
    const existingHighlights = containerRef.current.querySelectorAll('.violation-highlight');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        el.replaceWith(...Array.from(el.childNodes));
      }
    });

    // Apply new highlights
    violations.forEach(violation => {
      if (!violation.clause || violation.clause.length < 10) return;

      const searchText = violation.clause.substring(0, 50).toLowerCase();
      const walker = document.createTreeWalker(
        containerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.nodeValue?.toLowerCase() || '';
        const index = text.indexOf(searchText);
        
        if (index !== -1) {
          const span = document.createElement('span');
          span.className = cn(
            'violation-highlight inline px-1 rounded cursor-pointer transition-all',
            violation.severity === 'CRITICAL' ? 'bg-red-200 hover:bg-red-300' :
            violation.severity === 'HIGH' ? 'bg-orange-200 hover:bg-orange-300' :
            violation.severity === 'MEDIUM' ? 'bg-yellow-200 hover:bg-yellow-300' :
            'bg-blue-200 hover:bg-blue-300',
            selectedViolationId === violation.id && 'ring-2 ring-blue-500'
          );
          span.title = `${violation.type}: ${violation.description}`;
          span.onclick = () => onViolationClick?.(violation.id);
          span.setAttribute('data-violation-id', violation.id);

          const originalText = (node.nodeValue || '').substring(index, index + searchText.length);
          span.textContent = originalText;

          const parent = node.parentNode;
          if (parent) {
            const textBefore = (node.nodeValue || '').substring(0, index);
            const textAfter = (node.nodeValue || '').substring(index + searchText.length);
            
            if (textBefore) {
              parent.insertBefore(document.createTextNode(textBefore), node);
            }
            
            parent.insertBefore(span, node);
            
            if (textAfter) {
              node.nodeValue = textAfter;
            } else {
              parent.removeChild(node);
            }
            
            break; // Only highlight first occurrence
          }
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error && !documentContent) {
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
    <div className="flex flex-col h-full bg-white">
      {/* Violation indicators */}
      {violations.length > 0 && (
        <div className="p-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Click to highlight:</span>
            {violations.slice(0, 5).map(v => (
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
        <div 
          ref={containerRef}
          className="document-content max-w-4xl mx-auto"
          style={{
            minHeight: '100%',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.6,
            color: '#333'
          }}
          dangerouslySetInnerHTML={{ __html: documentContent }}
        />
      </div>

      <style jsx global>{`
        .document-content p {
          margin: 0.5em 0;
        }
        
        .document-content h1,
        .document-content h2,
        .document-content h3 {
          margin: 1em 0 0.5em 0;
          font-weight: 600;
        }
        
        .document-content h1 {
          font-size: 1.5em;
        }
        
        .document-content h2 {
          font-size: 1.3em;
        }
        
        .document-content h3 {
          font-size: 1.1em;
        }
        
        .document-content ul,
        .document-content ol {
          margin: 0.5em 0;
          padding-left: 2em;
        }
        
        .document-content li {
          margin: 0.25em 0;
        }
        
        .document-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .document-content td,
        .document-content th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .document-content th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        
        .document-content blockquote {
          border-left: 3px solid #ddd;
          margin: 1em 0;
          padding-left: 1em;
          color: #666;
        }
        
        .violation-highlight {
          position: relative;
          padding: 2px 4px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}