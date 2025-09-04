"use client";

import React, { useState, useEffect, useRef } from "react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Download, Eye } from "lucide-react";

interface DocxViewerWorkingProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom?: number;
}

export function DocxViewerWorking({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom = 100
}: DocxViewerWorkingProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [docxPreview, setDocxPreview] = useState<any>(null);

  // Load docx-preview library dynamically
  useEffect(() => {
    import('docx-preview').then((module) => {
      setDocxPreview(module);
    });
  }, []);

  useEffect(() => {
    if (!file || !docxPreview || !viewerRef.current) return;

    const renderDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // Clear previous content
        if (viewerRef.current) {
          viewerRef.current.innerHTML = '';
        }

        // Validate file type
        const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                      file.name.toLowerCase().endsWith('.docx');
        
        if (!isDocx) {
          throw new Error("Please upload a valid .docx file");
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Create container for styles
        const styleContainer = document.createElement('div');
        styleContainer.style.display = 'none';
        document.body.appendChild(styleContainer);

        // Render the document
        await docxPreview.renderAsync(
          arrayBuffer,
          viewerRef.current,
          styleContainer,
          {
            className: "docx-preview-content",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: false,
            useBase64URL: true,
            renderChanges: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            debug: false
          }
        );

        // Apply custom styles
        if (viewerRef.current) {
          // Add custom CSS for better display
          const style = document.createElement('style');
          style.textContent = `
            .docx-preview-content {
              font-family: 'Times New Roman', Georgia, serif;
              line-height: 1.6;
              color: #000;
              background: white;
            }
            .docx-preview-content .docx-wrapper {
              background: white;
              padding: 40px;
              max-width: 816px;
              margin: 0 auto;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .docx-preview-content section.docx {
              background: white;
              margin-bottom: 20px;
            }
            .docx-preview-content p {
              margin: 0.5em 0;
            }
            .docx-preview-content table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
            }
            .docx-preview-content td,
            .docx-preview-content th {
              border: 1px solid #ddd;
              padding: 8px;
            }
            .violation-highlight {
              background-color: rgba(250, 204, 21, 0.3);
              padding: 2px 4px;
              border-radius: 3px;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .violation-highlight:hover {
              background-color: rgba(250, 204, 21, 0.5);
            }
            .violation-critical {
              background-color: rgba(239, 68, 68, 0.3);
            }
            .violation-high {
              background-color: rgba(251, 146, 60, 0.3);
            }
            .violation-medium {
              background-color: rgba(250, 204, 21, 0.3);
            }
            .violation-selected {
              outline: 2px solid #3b82f6;
              outline-offset: 1px;
            }
          `;
          viewerRef.current.appendChild(style);
        }

        // Apply violation highlights
        setTimeout(() => applyViolationHighlights(), 500);

        setLoading(false);
      } catch (err: any) {
        console.error('Error rendering DOCX:', err);
        setError(err.message || 'Failed to render document');
        setLoading(false);
      }
    };

    renderDocument();
  }, [file, docxPreview]);

  const applyViolationHighlights = () => {
    if (!viewerRef.current || !violations.length) return;

    try {
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
        while (node = walker.nextNode()) {
          if (found) break;
          
          const text = node.nodeValue?.toLowerCase() || '';
          const index = text.indexOf(searchText.substring(0, 40));
          
          if (index !== -1 && node.parentElement) {
            const span = document.createElement('span');
            span.className = `violation-highlight violation-${violation.severity?.toLowerCase() || 'medium'}`;
            span.setAttribute('data-violation-id', violation.id);
            span.title = `${violation.type}: ${violation.description}`;
            span.onclick = () => onViolationClick?.(violation.id);
            
            const originalText = node.nodeValue || '';
            const matchLength = Math.min(100, originalText.length - index);
            const before = originalText.substring(0, index);
            const match = originalText.substring(index, index + matchLength);
            const after = originalText.substring(index + matchLength);
            
            const parent = node.parentElement;
            
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
    } catch (err) {
      console.error('Error applying highlights:', err);
    }
  };

  // Update highlights when selected violation changes
  useEffect(() => {
    if (!viewerRef.current) return;

    const highlights = viewerRef.current.querySelectorAll('.violation-highlight');
    highlights.forEach(el => {
      const violationId = el.getAttribute('data-violation-id');
      if (violationId === selectedViolationId) {
        el.classList.add('violation-selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('violation-selected');
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
            Try downloading the file or analyzing it for compliance
          </p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(file);
              const a = document.createElement('a');
              a.href = url;
              a.download = file.name;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm inline-flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Download File
          </button>
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
              Violations found:
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
                  // Scroll to the violation
                  const element = viewerRef.current?.querySelector(`[data-violation-id="${v.id}"]`);
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
      <div 
        ref={viewerRef}
        className="flex-1 overflow-auto bg-gray-100"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          width: `${100 * (100 / zoom)}%`,
          height: `${100 * (100 / zoom)}%`
        }}
      />
    </div>
  );
}