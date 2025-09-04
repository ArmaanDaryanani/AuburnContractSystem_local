"use client";

import React, { useState, useEffect } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { ViolationDetail } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

interface ReactDocViewerComponentProps {
  file: File;
  violations: ViolationDetail[];
  selectedViolationId?: string | null;
  onViolationClick?: (violationId: string) => void;
  zoom?: number;
}

export function ReactDocViewerComponent({
  file,
  violations,
  selectedViolationId,
  onViolationClick,
  zoom = 100
}: ReactDocViewerComponentProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (file) {
      // Convert File to object URL for the viewer
      const fileUrl = URL.createObjectURL(file);
      
      setDocuments([
        {
          uri: fileUrl,
          fileType: file.name.split('.').pop(),
          fileName: file.name
        }
      ]);
      
      setLoading(false);

      // Cleanup
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    }
  }, [file]);

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

  return (
    <div className="relative h-full">
      {/* Violation indicators */}
      {violations.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-white/95 backdrop-blur border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600 font-medium">Issues found:</span>
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
                onClick={() => onViolationClick?.(v.id)}
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

      {/* Document viewer */}
      <div className={cn(
        "h-full",
        violations.length > 0 && "pt-12"
      )}>
        <DocViewer
          documents={documents}
          pluginRenderers={DocViewerRenderers}
          config={{
            header: {
              disableHeader: true,
              disableFileName: true,
              retainURLParams: false
            },
            pdfZoom: {
              defaultZoom: zoom / 100,
              zoomJump: 0.1,
            },
            noRenderer: {
              overrideComponent: () => (
                <div className="flex flex-col items-center justify-center h-[400px]">
                  <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-sm font-medium text-gray-900">Unable to preview this document</p>
                  <p className="text-xs text-gray-600 mt-1">This file type may not be supported for preview</p>
                </div>
              )
            }
          }}
          style={{
            height: '100%',
            minHeight: '600px'
          }}
          className="doc-viewer-container"
        />
      </div>

      <style jsx global>{`
        .doc-viewer-container {
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        /* Style the document viewer iframe */
        .doc-viewer-container iframe {
          width: 100% !important;
          height: 100% !important;
          border: none;
          background: white;
        }
        
        /* Style the loading state */
        .doc-viewer-container .loading-renderer {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #f9fafb;
        }
        
        /* Style error state */
        .doc-viewer-container .no-renderer {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}