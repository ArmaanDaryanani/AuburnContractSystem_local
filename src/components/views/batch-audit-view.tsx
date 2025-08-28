"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  FolderOpen,
  Play,
  Pause,
  RefreshCw,
  FileSearch,
  Scale,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchFile {
  id: string;
  name: string;
  size: number;
  file: File; // Store the actual File object
  status: "pending" | "processing" | "complete" | "error";
  violations?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  progress?: number;
  farViolations?: string[];
  auburnViolations?: string[];
}

interface AuditResult {
  fileId: string;
  fileName: string;
  violations: number;
  findings: string[];
  confidence: number;
}

// Component for individual audit result card with modal for full findings
function AuditResultCard({ result }: { result: AuditResult }) {
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{result.fileName}</h4>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  result.violations === 0
                    ? "outline"
                    : result.violations < 2
                    ? "secondary"
                    : "destructive"
                }
              >
                {result.violations} violations
              </Badge>
              <span className="text-xs text-muted-foreground">
                {(result.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>
        </CardHeader>
        {result.findings.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {result.findings.map((finding, idx) => {
                // Parse the finding to extract title and description
                const colonIndex = finding.indexOf(':');
                const title = colonIndex > -1 ? finding.substring(0, colonIndex) : 'Finding ' + (idx + 1);
                const description = colonIndex > -1 ? finding.substring(colonIndex + 1).trim() : finding;
                const shouldTruncate = description.length > 120;
                const displayText = shouldTruncate 
                  ? description.substring(0, 120) + '...' 
                  : description;
                
                return (
                  <div
                    key={idx}
                    className="text-xs border rounded-md p-2 transition-all border-gray-200"
                  >
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                      <div className="flex-1">
                        <span className="font-medium text-gray-700">{title}:</span>
                        <span className="ml-1 text-gray-600">{displayText}</span>
                        {shouldTruncate && (
                          <span
                            className="ml-1 text-blue-600 cursor-pointer hover:underline"
                            onClick={() => {
                              console.log('Click detected! Opening modal for:', finding);
                              setSelectedFinding(finding);
                            }}
                          >
                            View full
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Modal for full finding text */}
      <Dialog open={selectedFinding !== null} onOpenChange={(open) => {
        if (!open) setSelectedFinding(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Full Finding Details - {result.fileName}</DialogTitle>
            <DialogDescription className="mt-4 text-sm whitespace-pre-wrap">
              {selectedFinding}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function BatchAuditView() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    const newFiles: BatchFile[] = Array.from(uploadedFiles).map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file: file, // Store the actual File object
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files Added",
      description: `Added ${newFiles.length} files to batch queue`,
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    const newFiles: BatchFile[] = droppedFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file: file, // Store the actual File object
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files Added",
      description: `Added ${newFiles.length} files to batch queue`,
    });
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const startBatchProcessing = async () => {
    if (files.length === 0) {
      toast({
        title: "No files to process",
        description: "Please add files before starting the audit",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCurrentFileIndex(0);
    setTotalProgress(0);
    setAuditResults([]);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      const file = files[i];

      // Update file status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "processing" as const, progress: 0 } : f
        )
      );

      try {
        // Use the stored file object
        if (file.file) {
          // Extract text from file
          const text = await extractTextFromFile(file.file);
          
          // Update progress
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, progress: 30 } : f
            )
          );

          // Send to AI for analysis using the same contract-stream endpoint
          const response = await fetch('/api/contract-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              fileName: file.name,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to analyze contract');
          }

          // Process the streaming response
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response stream');

          const decoder = new TextDecoder();
          const issues: any[] = [];
          let summary: any = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
              const data = line.slice(6); // Remove 'data: '
              
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'issue') {
                  issues.push(parsed.data);
                } else if (parsed.type === 'complete') {
                  summary = parsed.summary;
                } else if (parsed.type === 'progress') {
                  // Update progress
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === file.id ? { ...f, progress: 60 } : f
                    )
                  );
                }
              } catch (e) {
                // Skip unparseable lines
              }
            }
          }

          // Calculate risk level based on issues
          const highSeverityCount = issues.filter(i => i.severity === 'HIGH').length;
          const mediumSeverityCount = issues.filter(i => i.severity === 'MEDIUM').length;
          const violations = issues.length;
          
          let riskLevel: "low" | "medium" | "high" | "critical";
          if (violations === 0) {
            riskLevel = "low";
          } else if (highSeverityCount >= 3) {
            riskLevel = "critical";
          } else if (highSeverityCount >= 1) {
            riskLevel = "high";
          } else if (mediumSeverityCount >= 2) {
            riskLevel = "medium";
          } else {
            riskLevel = "low";
          }

          // Extract FAR and Auburn violations
          const farViolations = issues
            .filter(i => i.farClause)
            .map(i => `${i.farClause} - ${i.title}`);
          
          const auburnViolations = issues
            .filter(i => i.auburnPolicy)
            .map(i => `${i.auburnPolicy} - ${i.title}`);

          // Update file with results
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: "complete" as const,
                    violations,
                    riskLevel,
                    farViolations: farViolations.slice(0, 5), // Limit display
                    auburnViolations: auburnViolations.slice(0, 5),
                    progress: 100,
                  }
                : f
            )
          );

          // Add to audit results
          setAuditResults((prev) => [
            ...prev,
            {
              fileId: file.id,
              fileName: file.name,
              violations,
              findings: issues.map(i => `${i.title}: ${i.description}`).slice(0, 10), // Store full text, not truncated
              confidence: issues.reduce((sum, i) => sum + (i.confidence || 85), 0) / Math.max(issues.length, 1) / 100,
            },
          ]);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        
        // Mark file as error
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "error" as const,
                  violations: 0,
                  riskLevel: "low",
                  progress: 100,
                }
              : f
          )
        );
      }

      // Update total progress
      setTotalProgress(((i + 1) / files.length) * 100);
    }

    setIsProcessing(false);
    toast({
      title: "Batch Audit Complete",
      description: `Processed ${files.length} files. ${auditResults.filter(r => r.violations > 0).length} files have violations.`,
    });
  };

  // Helper function to extract text from files
  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain') {
      return await file.text();
    } else if (file.type === 'application/pdf') {
      // For PDF files, we'll use a simple text extraction
      // In production, you'd use a proper PDF parser
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/documents/extract-text', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const { text } = await response.json();
          return text;
        }
      } catch (e) {
        console.error('Failed to extract PDF text:', e);
      }
      
      // Fallback to basic text
      return `Contract document: ${file.name}\n\n[PDF content would be extracted here]`;
    } else {
      // For other file types, return placeholder
      return `Contract document: ${file.name}\n\n[Document content would be extracted here]`;
    }
  };

  const exportBatchResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      filesWithViolations: auditResults.filter(r => r.violations > 0).length,
      results: auditResults,
      summary: {
        criticalRisk: files.filter(f => f.riskLevel === "critical").length,
        highRisk: files.filter(f => f.riskLevel === "high").length,
        mediumRisk: files.filter(f => f.riskLevel === "medium").length,
        lowRisk: files.filter(f => f.riskLevel === "low").length,
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-audit-${Date.now()}.json`;
    a.click();
  };

  const clearBatch = () => {
    setFiles([]);
    setAuditResults([]);
    setTotalProgress(0);
    setCurrentFileIndex(0);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Batch Sub-Agreement Audit</h1>
          <p className="text-sm text-gray-600 mt-2">
            Process multiple contracts simultaneously for comprehensive compliance auditing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearBatch}
            disabled={isProcessing}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          <Button
            onClick={startBatchProcessing}
            disabled={isProcessing || files.length === 0}
          >
            {isProcessing ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Audit
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Section */}
        <Card className="lg:col-span-1 border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900">File Upload</CardTitle>
            <CardDescription className="text-xs text-gray-600">Add multiple contracts for batch processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors cursor-pointer bg-gray-50/50"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen className="h-10 w-10 mx-auto text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-700">Drop contract files here</p>
              <p className="text-xs text-gray-500 mt-1">
                or click to browse (PDF, DOCX, TXT)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* File Queue */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Queue ({files.length})</h4>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No files added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md text-sm",
                          file.status === "processing" && "bg-accent",
                          file.status === "complete" && "bg-green-50 dark:bg-green-950/20",
                          file.status === "error" && "bg-red-50 dark:bg-red-950/20"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="truncate max-w-[150px]">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === "processing" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {file.status === "complete" && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {file.violations !== undefined && file.violations > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {file.violations}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Processing file {currentFileIndex + 1} of {files.length}
                  </span>
                  <span className="font-medium">{Math.round(totalProgress)}%</span>
                </div>
                <Progress value={totalProgress} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit Results</CardTitle>
                <CardDescription>
                  Real-time compliance analysis results
                </CardDescription>
              </div>
              {auditResults.length > 0 && (
                <Button onClick={exportBatchResults} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="details">Detailed Results</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {/* Risk Distribution */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Critical Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {files.filter(f => f.riskLevel === "critical").length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">High Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {files.filter(f => f.riskLevel === "high").length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Medium Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">
                        {files.filter(f => f.riskLevel === "medium").length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Low Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {files.filter(f => f.riskLevel === "low").length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Common Issues */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Common Compliance Issues</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Alert>
                      <Scale className="h-4 w-4" />
                      <AlertTitle className="text-sm">FAR Violations</AlertTitle>
                      <AlertDescription className="text-xs">
                        Found in {files.filter(f => f.farViolations && f.farViolations.length > 0).length} files
                      </AlertDescription>
                    </Alert>
                    <Alert>
                      <BookOpen className="h-4 w-4" />
                      <AlertTitle className="text-sm">Auburn Policy Violations</AlertTitle>
                      <AlertDescription className="text-xs">
                        Found in {files.filter(f => f.auburnViolations && f.auburnViolations.length > 0).length} files
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <div className="h-[500px] overflow-y-auto">
                  <div className="space-y-4">
                    {auditResults.map((result) => (
                      <AuditResultCard key={result.fileId} result={result} />
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      {auditResults.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditResults.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {auditResults.reduce((sum, r) => sum + r.violations, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {auditResults.length > 0
                  ? Math.round(
                      (auditResults.filter((r) => r.violations === 0).length /
                        auditResults.length) *
                        100
                    )
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {auditResults.length > 0
                  ? (
                      auditResults.reduce((sum, r) => sum + r.confidence, 0) /
                      auditResults.length *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}