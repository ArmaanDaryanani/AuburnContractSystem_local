"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2
} from "lucide-react";
import { ViolationDetail } from "@/lib/contract-analysis";
import { detectDocumentType, DocumentType } from "@/lib/document-utils";
import dynamic from 'next/dynamic';
import { cn } from "@/lib/utils";

// Dynamic import for the universal document viewer
const UniversalDocViewer = dynamic(
  () => import('./react-doc-viewer-component').then(mod => mod.ReactDocViewerComponent),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading document viewer...</p>
        </div>
      </div>
    )
  }
);

interface DocumentViewerProps {
  file: File | null;
  violations: ViolationDetail[];
  onViolationClick?: (violationId: string) => void;
  selectedViolationId?: string | null;
}

export function DocumentViewer({
  file,
  violations,
  onViolationClick,
  selectedViolationId
}: DocumentViewerProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.UNKNOWN);
  const [activeView, setActiveView] = useState<'document' | 'violations'>('document');
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (file) {
      const docInfo = detectDocumentType(file);
      setDocumentType(docInfo.type);
    }
  }, [file]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  if (!file) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">No document loaded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm h-full">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">{file.name}</span>
            <Badge variant="outline" className="text-xs">
              {documentType}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-600 min-w-[40px] text-center">
              {zoom}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleResetZoom}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Reset Zoom"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {violations.length > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-600">Issues found:</span>
            <div className="flex gap-2">
              {violations.filter(v => v.severity === 'CRITICAL').length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {violations.filter(v => v.severity === 'CRITICAL').length} Critical
                </Badge>
              )}
              {violations.filter(v => v.severity === 'HIGH').length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {violations.filter(v => v.severity === 'HIGH').length} High
                </Badge>
              )}
              {violations.filter(v => v.severity === 'MEDIUM').length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {violations.filter(v => v.severity === 'MEDIUM').length} Medium
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-0">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
            <TabsTrigger value="document">Document View</TabsTrigger>
            <TabsTrigger value="violations">
              Violations ({violations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="document" className="m-0">
            <div className="relative" style={{ height: '600px' }}>
              {(documentType === DocumentType.PDF || documentType === DocumentType.DOCX) && (
                <UniversalDocViewer
                  file={file}
                  violations={violations}
                  selectedViolationId={selectedViolationId}
                  onViolationClick={onViolationClick}
                  zoom={zoom}
                />
              )}
              {documentType === DocumentType.TXT && (
                <div className="p-6 h-full overflow-auto bg-white">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {/* Text content would be loaded here */}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="violations" className="m-0">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-3">
                {violations.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">No violations found</p>
                  </div>
                ) : (
                  violations.map((violation) => (
                    <Card
                      key={violation.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedViolationId === violation.id && "ring-2 ring-blue-500"
                      )}
                      onClick={() => onViolationClick?.(violation.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {violation.severity === "CRITICAL" && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            {violation.severity === "HIGH" && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                            {violation.severity === "MEDIUM" && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            <span className="text-sm font-medium">{violation.type}</span>
                          </div>
                          <Badge
                            variant={
                              violation.severity === "CRITICAL" ? "destructive" :
                              violation.severity === "HIGH" ? "secondary" :
                              "outline"
                            }
                            className="text-xs"
                          >
                            {violation.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{violation.description}</p>
                        {violation.clause && (
                          <div className="bg-gray-50 p-2 rounded text-xs font-mono mb-2">
                            "{violation.clause.substring(0, 100)}..."
                          </div>
                        )}
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="text-xs text-green-800">
                            <strong>Fix:</strong> {violation.suggestion}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}