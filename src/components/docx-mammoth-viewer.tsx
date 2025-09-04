"use client";

import React, { useState, useEffect, useRef } from "react";
import mammoth from "mammoth";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Download, Eye, FileText } from "lucide-react";

interface DocxMammothViewerProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom?: number;
}

export function DocxMammothViewer({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom = 100
}: DocxMammothViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) return;

    const convertDocument = async () => {
      console.log('Starting mammoth conversion for:', file.name);
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
            console.log('File loaded, converting with mammoth...');
            
            // Convert with mammoth - simpler without image handling for now
            const result = await mammoth.convertToHtml({
              arrayBuffer: arrayBuffer
            });
            
            console.log('Conversion complete, messages:', result.messages);
            
            // Create styled HTML
            const styledHtml = `
              <div class="docx-content">
                <style>
                  .docx-content {
                    font-family: 'Times New Roman', Georgia, serif;
                    line-height: 1.8;
                    color: #000;
                    background: white;
                    padding: 40px;
                    max-width: 816px;
                    margin: 0 auto;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                  }
                  .docx-content p {
                    margin: 1em 0;
                    text-align: justify;
                  }
                  .docx-content h1, 
                  .docx-content h2, 
                  .docx-content h3 {
                    margin: 1.5em 0 0.5em 0;
                    font-weight: bold;
                  }
                  .docx-content h1 { font-size: 2em; }
                  .docx-content h2 { font-size: 1.5em; }
                  .docx-content h3 { font-size: 1.2em; }
                  .docx-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                  }
                  .docx-content td, 
                  .docx-content th {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                  }
                  .docx-content th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                  }
                  .docx-content img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 1em auto;
                  }
                  .docx-content ul, 
                  .docx-content ol {
                    margin: 1em 0;
                    padding-left: 2em;
                  }
                  .docx-content li {
                    margin: 0.5em 0;
                  }
                  .docx-content blockquote {
                    border-left: 4px solid #ddd;
                    margin: 1em 0;
                    padding-left: 1em;
                    color: #666;
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
                </style>
                ${result.value}
              </div>
            `;
            
            setHtmlContent(styledHtml);
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
  }, [file]);

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
          <p className="text-sm text-gray-600">Converting document...</p>
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
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500">
              Try analyzing the document for compliance or download it
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
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm inline-flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Download File
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No content to display</p>
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
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}