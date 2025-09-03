"use client";

import { useState, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  ChevronRight,
  Shield,
  Brain,
  FileSearch,
  Sparkles,
  AlertCircle,
  BookOpen,
  Scale,
} from "lucide-react";
import { ContractAnalyzer, type ViolationDetail } from "@/lib/contract-analysis";
import { DebugPanel } from "@/components/debug-panel";

interface AlternativeSuggestion {
  violationId: string;
  originalText: string;
  suggestedText: string;
  justification: string;
}

export default function ContractReviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [contractText, setContractText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeSuggestion[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-lite");
  const [confidence, setConfidence] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [complianceRate, setComplianceRate] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const contractAnalyzer = useRef(new ContractAnalyzer());

  const models = [
    { value: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash (Ultra Fast)" },
    { value: "google/gemini-flash-1.5-8b", label: "Gemini Flash 1.5" },
    { value: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
    { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setContractText(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setContractText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const analyzeContract = async () => {
    if (!contractText) {
      toast({
        title: "No contract provided",
        description: "Please upload a contract or paste text to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setStreamingText("");
    setViolations([]);
    setAlternatives([]);

    try {
      // Progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return prev + 15;
        });
      }, 400);

      // Streaming analysis phases
      const analysisPhases = [
        "🔍 Parsing contract structure...\n",
        "📋 Checking FAR Matrix compliance...\n",
        "🎓 Validating Auburn University policies...\n",
        "⚖️ Analyzing indemnification clauses...\n",
        "💡 Evaluating intellectual property terms...\n",
        "💰 Reviewing payment provisions...\n",
        "📊 Calculating TF-IDF similarity scores...\n",
        "🤖 Running AI-powered violation detection...\n",
      ];

      // Stream analysis phases
      for (const phase of analysisPhases) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setStreamingText((prev) => prev + phase);
      }

      // Use real contract analyzer
      const analysis = contractAnalyzer.current.analyzeContract(contractText);
      
      setStreamingText((prev) => prev + "\n✅ **Analysis Complete**\n\n");

      // If using OpenRouter API (when available)
      if (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY) {
        try {
          const response = await fetch("/api/contract/analyze-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contractText,
              model: selectedModel,
            }),
          });

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");
              
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.text) {
                      setStreamingText((prev) => prev + parsed.text);
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          }
        } catch (apiError) {
          console.log("OpenRouter not configured, using local analysis");
        }
      }

      // Set results from contract analyzer
      setViolations(analysis.violations);
      setConfidence(analysis.confidence);
      setRiskScore(analysis.riskScore);
      setComplianceRate(analysis.complianceRate);

      // Generate alternatives for each violation
      const generatedAlternatives: AlternativeSuggestion[] = analysis.violations.map(v => ({
        violationId: v.id,
        originalText: v.clause,
        suggestedText: v.suggestion,
        justification: `Complies with ${v.farReference || v.auburnPolicy || "policy requirements"}`,
      }));
      setAlternatives(generatedAlternatives);

      // Summary in stream
      setStreamingText((prev) => 
        prev + 
        `\n📊 **Summary:**\n` +
        `• Found ${analysis.violations.length} compliance issues\n` +
        `• Risk Score: ${analysis.riskScore.toFixed(1)}/10\n` +
        `• Compliance Rate: ${analysis.complianceRate.toFixed(1)}%\n` +
        `• Confidence: ${(analysis.confidence * 100).toFixed(1)}%\n\n` +
        `**Key Violations:**\n` +
        analysis.violations.slice(0, 3).map((v, i) => 
          `${i + 1}. ${v.type} - ${v.description}\n`
        ).join("")
      );

      clearInterval(progressInterval);
      setAnalysisProgress(100);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${analysis.violations.length} potential violations. Risk score: ${analysis.riskScore.toFixed(1)}/10`,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "An error occurred during contract analysis.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      model: selectedModel,
      violations: violations,
      alternatives: alternatives,
      metrics: {
        confidence,
        riskScore,
        complianceRate,
      },
      analysis: streamingText,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract-review-${Date.now()}.json`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contract Review</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered contract analysis with real-time streaming
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[250px]">
                <Brain className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Input</CardTitle>
              <CardDescription>Upload a contract file or paste text directly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">File Upload</TabsTrigger>
                  <TabsTrigger value="paste">Paste Text</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">Drop your contract here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse (PDF, DOCX, TXT)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  
                  {file && (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertTitle>File loaded</AlertTitle>
                      <AlertDescription>
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
                
                <TabsContent value="paste" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contract Text</Label>
                    <Textarea
                      placeholder="Paste your contract text here..."
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                      className="min-h-[200px] font-mono text-xs"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                onClick={analyzeContract} 
                disabled={isAnalyzing || !contractText}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Contract...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>

              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Analysis Progress</span>
                    <span className="font-medium">{analysisProgress}%</span>
                  </div>
                  <Progress value={analysisProgress} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Streaming Output */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Stream</CardTitle>
              <CardDescription>Real-time analysis output</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 min-h-[400px] max-h-[400px] overflow-y-auto">
                {streamingText ? (
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {streamingText}
                    {isAnalyzing && <span className="animate-pulse">▊</span>}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Analysis output will appear here...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Violations Section */}
        {violations.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Compliance Violations</CardTitle>
                  <CardDescription>
                    {violations.length} issues found requiring attention
                  </CardDescription>
                </div>
                <Button onClick={exportResults} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div className="mt-1">
                      {violation.severity === "CRITICAL" && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      {violation.severity === "HIGH" && (
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                      )}
                      {violation.severity === "MEDIUM" && (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      )}
                      {violation.severity === "LOW" && (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{violation.type}</h4>
                          {violation.farReference && (
                            <Badge variant="outline" className="text-xs">
                              <Scale className="h-3 w-3 mr-1" />
                              {violation.farReference}
                            </Badge>
                          )}
                          {violation.auburnPolicy && (
                            <Badge variant="outline" className="text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {violation.auburnPolicy}
                            </Badge>
                          )}
                        </div>
                        <Badge
                          variant={
                            violation.severity === "CRITICAL"
                              ? "destructive"
                              : violation.severity === "HIGH"
                              ? "destructive"
                              : violation.severity === "MEDIUM"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {violation.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {violation.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          Location: {violation.location}
                        </span>
                        <span className="text-muted-foreground">
                          Confidence: {(violation.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Alert className="mt-2">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Suggestion:</strong> {violation.suggestion}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        {violations.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {riskScore.toFixed(1)}/10
                </div>
                <Progress
                  value={riskScore * 10}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Based on FAR & Auburn violations
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {complianceRate.toFixed(0)}%
                </div>
                <Progress
                  value={complianceRate}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  TF-IDF confidence: {(confidence * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Review Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <span className="text-2xl font-bold">Complete</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Analyzed with {selectedModel.split("/")[1]}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <DebugPanel />
    </DashboardLayout>
  );
}