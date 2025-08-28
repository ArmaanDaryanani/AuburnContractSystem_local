"use client";

import { useState, useRef, useCallback } from "react";
import { NavigationMinimal } from "@/components/navigation-minimal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { SubAgreementScanner, subAgreementScanner } from "@/lib/contract-analysis";
import { cn } from "@/lib/utils";

interface BatchFile {
  id: string;
  name: string;
  size: number;
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

export default function BatchAuditPage() {
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

      // Simulate processing with progress updates
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, progress } : f
          )
        );
      }

      // Generate mock results
      const violations = Math.floor(Math.random() * 5);
      const riskLevel = violations === 0 ? "low" : violations < 2 ? "medium" : violations < 4 ? "high" : "critical";
      
      const farViolations = violations > 0 ? [
        "FAR 28.106 - Indemnification clause",
        "FAR 27.402 - IP assignment",
      ].slice(0, violations) : [];
      
      const auburnViolations = violations > 1 ? [
        "Publication Rights",
        "Termination Provisions",
        "Insurance Requirements",
      ].slice(0, violations - 1) : [];

      // Update file with results
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                status: "complete" as const,
                violations,
                riskLevel,
                farViolations,
                auburnViolations,
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
          findings: [...farViolations, ...auburnViolations],
          confidence: 0.85 + Math.random() * 0.1,
        },
      ]);

      // Update total progress
      setTotalProgress(((i + 1) / files.length) * 100);
    }

    setIsProcessing(false);
    toast({
      title: "Batch Audit Complete",
      description: `Processed ${files.length} files. ${auditResults.filter(r => r.violations > 0).length} files have violations.`,
    });
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
    <div className="flex h-screen bg-white">
      <NavigationMinimal />
      
      <div className="flex-1 overflow-y-auto">
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
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {auditResults.map((result) => (
                        <Card key={result.fileId}>
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
                              <div className="space-y-1">
                                {result.findings.map((finding, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <ChevronRight className="h-3 w-3" />
                                    <span>{finding}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
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
      </div>
    </div>
  );
}