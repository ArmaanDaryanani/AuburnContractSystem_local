"use client";

import React, { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, FileText, Eye } from "lucide-react";

interface SimpleDocxViewerProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom?: number;
}

export function SimpleDocxViewer({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom = 100
}: SimpleDocxViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [documentHtml, setDocumentHtml] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // Extract text using our API
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/documents/extract-text', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to extract text: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.error && !result.text) {
          throw new Error(result.error);
        }

        // Use HTML if available, otherwise format text
        if (result.html) {
          setDocumentHtml(result.html);
        } else if (result.text) {
          // Convert plain text to HTML with paragraphs
          const paragraphs = result.text
            .split(/\n\n+/)
            .filter(p => p.trim())
            .map(p => {
              // Check if it looks like a heading (all caps or starts with number)
              if (p.match(/^[A-Z\s]+$/) || p.match(/^\d+\./)) {
                return `<h3>${p}</h3>`;
              }
              // Check if it's a list item
              if (p.match(/^[\-\•\*]\s/)) {
                return `<li>${p.substring(2)}</li>`;
              }
              return `<p>${p}</p>`;
            })
            .join('\n');
          
          setDocumentHtml(`<div class="document-content">${paragraphs}</div>`);
        }
        
        setDocumentContent(result.text || '');
        setLoading(false);

        // Apply highlights after rendering
        setTimeout(() => applyHighlights(), 100);
        
      } catch (err: any) {
        console.error('Error loading document:', err);
        setError(err.message || 'Failed to load document');
        setLoading(false);
      }
    };

    if (file) {
      loadDocument();
    }
  }, [file]);

  const applyHighlights = () => {
    if (!containerRef.current || !documentContent || violations.length === 0) return;

    violations.forEach((violation, index) => {
      if (!violation.clause || violation.clause.length < 20) return;

      // Find and highlight text
      const searchText = violation.clause.substring(0, 80).toLowerCase();
      const elements = containerRef.current!.getElementsByTagName('*');
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.children.length === 0 && element.textContent) {
          const text = element.textContent.toLowerCase();
          const pos = text.indexOf(searchText.substring(0, 40));
          
          if (pos !== -1) {
            const originalText = element.textContent;
            const before = originalText.substring(0, pos);
            const match = originalText.substring(pos, pos + 40);
            const after = originalText.substring(pos + 40);
            
            const highlightedHtml = `${before}<span class="violation-highlight violation-${violation.severity?.toLowerCase() || 'medium'}" data-violation-id="${violation.id}" title="${violation.type}: ${violation.description}">${match}</span>${after}`;
            
            element.innerHTML = highlightedHtml;
            
            // Add click handler
            const highlight = element.querySelector(`[data-violation-id="${violation.id}"]`);
            if (highlight) {
              highlight.addEventListener('click', () => onViolationClick?.(violation.id));
            }
            
            break; // Only highlight first occurrence
          }
        }
      }
    });
  };

  // Update highlight selection
  useEffect(() => {
    if (!containerRef.current) return;

    const highlights = containerRef.current.querySelectorAll('.violation-highlight');
    highlights.forEach(el => {
      const violationId = el.getAttribute('data-violation-id');
      if (violationId === selectedViolationId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }, [selectedViolationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading document...</p>
          <p className="text-xs text-gray-500 mt-2">Processing {file.name}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Unable to display document</p>
          <p className="text-xs text-gray-600">{error}</p>
          <p className="text-xs text-gray-500 mt-4">
            The document has been loaded and can still be analyzed for compliance issues
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with violations */}
      {violations.length > 0 && (
        <div className="flex-shrink-0 p-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600 font-medium">
              <Eye className="inline h-3 w-3 mr-1" />
              Click to view issues:
            </span>
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

      {/* Document content */}
      <div 
        className="flex-1 overflow-auto"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center'
        }}
      >
        <div className="max-w-4xl mx-auto bg-white shadow-sm my-8">
          <div className="flex items-center gap-2 px-8 py-4 border-b bg-gray-50">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{file.name}</span>
          </div>
          
          <div 
            ref={containerRef}
            className="document-container px-12 py-8"
            dangerouslySetInnerHTML={{ __html: documentHtml }}
          />
        </div>
      </div>

      <style jsx global>{`
        .document-container {
          font-family: 'Times New Roman', Georgia, serif;
          font-size: 12pt;
          line-height: 1.8;
          color: #000;
        }

        .document-container p {
          margin: 0 0 1em 0;
          text-align: justify;
        }

        .document-container h1,
        .document-container h2,
        .document-container h3 {
          font-weight: bold;
          margin: 1.5em 0 0.5em 0;
          text-align: left;
        }

        .document-container h1 {
          font-size: 16pt;
        }

        .document-container h2 {
          font-size: 14pt;
        }

        .document-container h3 {
          font-size: 12pt;
        }

        .document-container ul,
        .document-container ol {
          margin: 0.5em 0 1em 2em;
        }

        .document-container li {
          margin: 0.25em 0;
        }

        .document-container table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }

        .document-container td,
        .document-container th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        .document-container th {
          background-color: #f5f5f5;
          font-weight: bold;
        }

        /* Violation highlights */
        .violation-highlight {
          padding: 2px 4px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-block;
        }

        .violation-critical {
          background-color: rgba(239, 68, 68, 0.25);
        }
        .violation-critical:hover {
          background-color: rgba(239, 68, 68, 0.35);
        }

        .violation-high {
          background-color: rgba(251, 146, 60, 0.25);
        }
        .violation-high:hover {
          background-color: rgba(251, 146, 60, 0.35);
        }

        .violation-medium {
          background-color: rgba(250, 204, 21, 0.25);
        }
        .violation-medium:hover {
          background-color: rgba(250, 204, 21, 0.35);
        }

        .violation-low {
          background-color: rgba(59, 130, 246, 0.25);
        }
        .violation-low:hover {
          background-color: rgba(59, 130, 246, 0.35);
        }

        .violation-highlight.selected {
          outline: 2px solid #3b82f6;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}