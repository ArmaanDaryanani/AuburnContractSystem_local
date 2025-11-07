"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { ContractAnalyzer, type ViolationDetail } from "@/lib/contract-analysis";
import { DocumentViewerPaginated } from "@/components/document-viewer-paginated";
import { extractTextFromFile } from "@/lib/document-extractor";
import { detectDocumentType } from "@/lib/document-utils";

export default function ContractReviewSimplified() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [docxText, setDocxText] = useState("");
  const [textReady, setTextReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const contractAnalyzer = useRef(new ContractAnalyzer());

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setHasAnalyzed(false);
      setViolations([]);
      setPdfText("");
      setDocxText("");
      setTextReady(false);
      
      // For PDFs, text extraction happens in PDFViewerPaginated via onTextExtracted
      // For DOCX, text extraction happens in DocumentViewerPaginated via onTextExtracted
      console.log('File loaded:', file.name, 'Type:', file.type);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setFile(file);
      setHasAnalyzed(false);
      setViolations([]);
      setPdfText("");
      setDocxText("");
      setTextReady(false);
      
      // For PDFs, text extraction happens in PDFViewerPaginated via onTextExtracted
      // For DOCX, text extraction happens in DocumentViewerPaginated via onTextExtracted
      console.log('File dropped:', file.name, 'Type:', file.type);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const analyzeContract = async () => {
    const isPDF = file?.type?.toLowerCase().includes('pdf');
    const contractText = isPDF ? pdfText : docxText;
    
    // Guard: ensure text is ready
    if (!contractText || contractText.length === 0) {
      console.warn("Text not ready - please wait for extraction to complete");
      return;
    }

    console.log('🔍 Starting analysis');
    console.log('📊 File type:', isPDF ? 'PDF' : 'DOCX');
    console.log('📊 Text length:', contractText.length);
    console.log('📝 Sample text:', contractText.substring(0, 200));

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setViolations([]);
    setHasAnalyzed(false);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Send ONLY cachedText (one source of truth)
      const response = await fetch("/api/contract/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cachedText: contractText, // ONLY field - no text/contractText confusion
          fileName: file?.name || "contract.txt",
          useAI: true
        }),
      });
      
      console.log('📤 Sent to API:', contractText.length, 'chars');

      let result;
      if (response.ok) {
        result = await response.json();
        console.log('✅ API Analysis result:', result);
      } else {
        console.log('⚠️ API failed, using local analysis');
        // Fallback to local analysis
        const fallbackText = isPDF ? pdfText : docxText;
        const analysis = contractAnalyzer.current.analyzeContract(fallbackText);
        result = {
          violations: analysis.violations,
          confidence: analysis.confidence,
          riskScore: analysis.riskScore
        };
        console.log('📊 Local analysis result:', result);
      }
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      
      // Filter to only show violations with valid indices
      const validViolations = (result.violations || []).filter((v: ViolationDetail) => {
        if (!v.problematicText || v.problematicText === 'MISSING_CLAUSE') {
          return true; // Keep missing clause violations
        }
        
        // Require valid start/end indices
        if (typeof v.start !== 'number' || typeof v.end !== 'number') {
          console.log(`❌ Excluding violation "${v.id}" - missing indices`);
          return false;
        }
        
        const textLength = isPDF ? pdfText.length : docxText.length;
        if (v.end <= v.start || v.start < 0 || v.end > textLength) {
          console.log(`❌ Excluding violation "${v.id}" - invalid indices (${v.start}-${v.end}, max: ${textLength})`);
          return false;
        }
        
        return true;
      });
      
      setViolations(validViolations);
      setConfidence(result.confidence || 85);
      setRiskScore(result.riskScore || 0);
      setHasAnalyzed(true);
      
      // Analysis complete - log violations details
      console.log(`Analysis complete: Found ${validViolations.length} highlightable compliance issues (${result.violations?.length || 0} total detected)`);
      console.log('🔍 Violations detail:', JSON.stringify(validViolations, null, 2));
      
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Fallback to TF-IDF analysis
      const fallbackText = isPDF ? pdfText : docxText;
      const analysis = contractAnalyzer.current.analyzeContract(fallbackText);
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      
      setViolations(analysis.violations);
      setConfidence(analysis.confidence);
      setRiskScore(analysis.riskScore);
      setHasAnalyzed(true);
      
      // Analysis complete - no toast needed
      console.log(`Analysis complete (offline): Found ${analysis.violations.length} compliance issues`);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setAnalysisProgress(0), 1000);
    }
  };

  const handleViolationClick = (violationId: string) => {
    setSelectedViolationId(violationId);
    // Scroll to violation details if needed
    const element = document.getElementById(`violation-${violationId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className={file ? "h-dvh flex flex-col" : "min-h-dvh bg-gray-50"}>
      <div className={file ? "flex-1 flex flex-col min-h-0 overflow-auto" : "max-w-7xl mx-auto p-6"}>
        {/* Header - Only show when no document */}
        {!file && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Contract Review System
            </h1>
            <p className="text-gray-600">
              Auburn University Office of Sponsored Programs
            </p>
          </div>
        )}


        <div className={file ? "" : "max-w-5xl mx-auto"}>
          {/* Document Display */}
          <div className={file ? "" : "space-y-4"}>
            {!file ? (
              <Card>
                <CardContent className="p-8">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Upload Contract Document
                    </p>
                    <p className="text-sm text-gray-500">
                      Drop your PDF or DOCX file here, or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  <Button
                    onClick={analyzeContract}
                    disabled={!textReady || isAnalyzing || (pdfText.length === 0 && docxText.length === 0)}
                    className="w-full mt-4"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Contract
                      </>
                    )}
                  </Button>

                  {isAnalyzing && (
                    <div className="mt-4">
                      <Progress value={analysisProgress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Analyzing contract... {analysisProgress}%
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <DocumentViewerPaginated
                file={file}
                violations={violations}
                onAnalyze={analyzeContract}
                isAnalyzing={isAnalyzing}
                onTextExtracted={(text) => {
                  const isPDF = file?.type?.toLowerCase().includes('pdf');
                  console.log(`📄 Text extracted from ${isPDF ? 'PDF' : 'DOCX'}, length:`, text.length);
                  console.log('📄 Sample of extracted text:', text.substring(0, 200));
                  
                  if (isPDF) {
                    setPdfText(text);
                  } else {
                    setDocxText(text);
                  }
                  setTextReady(true);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}