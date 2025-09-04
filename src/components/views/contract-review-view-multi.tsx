"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { logger } from "@/lib/console-logger";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Loader2,
  Download,
  Sparkles,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Shield,
  Send,
  Bot,
  User,
  StopCircle,
  Eye,
  PartyPopper,
  X,
  Plus,
  Split,
  FileCheck,
} from "lucide-react";
import { ContractAnalyzer } from "@/lib/contract-analysis";
import { ContractDocumentInline } from "@/components/contract-document-inline";
import { DocumentComparer } from "@/components/document-comparer";
import dynamic from 'next/dynamic';
import { cn } from "@/lib/utils";
import { extractTextFromFile } from "@/lib/document-extractor";
import { detectDocumentType } from "@/lib/document-utils";
import { useContractReview, type ContractDocument, type DocumentType } from "@/contexts/ContractReviewContext";

// Dynamically import PDF viewer to avoid SSR issues
const ContractDocumentInlinePDF = dynamic(
  () => import("@/components/contract-document-inline-pdf").then(mod => mod.ContractDocumentInlinePDF),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
);

// Dynamically import DOCX viewer to avoid SSR issues
const ContractDocumentInlineDOCX = dynamic(
  () => import("@/components/document-viewer").then(mod => mod.DocumentViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
);

export default function ContractReviewViewMulti() {
  const {
    state,
    addDocument,
    removeDocument,
    setActiveDocument,
    updateDocument,
    getActiveDocument,
    getDocument,
    enableComparison,
    disableComparison,
    updateState,
    addMessage,
    clearSession,
  } = useContractReview();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const violationsListRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const contractAnalyzer = useRef(new ContractAnalyzer());

  // Get active document
  const activeDoc = getActiveDocument();
  
  // Log component mount
  useEffect(() => {
    logger.log('ContractReviewViewMulti', 'Component mounted with multi-document support');
    logger.info('ContractReviewViewMulti', 'Session initialized', {
      sessionId: state.sessionId,
      documentCount: state.documents.length,
      comparisonMode: state.comparison.enabled
    });
  }, []);
  
  // Trigger confetti when analysis completes with no violations
  useEffect(() => {
    if (activeDoc?.hasAnalyzed && activeDoc?.violations.length === 0) {
      // Fire confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.6 }
      });
    }
  }, [activeDoc?.hasAnalyzed, activeDoc?.violations.length]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check if document already exists
      const exists = state.documents.some(doc => 
        doc.name === file.name && doc.size === file.size
      );
      
      if (exists) {
        toast({
          title: "Document already loaded",
          description: `${file.name} is already in the session`,
          variant: "default",
        });
        continue;
      }
      
      toast({
        title: "Processing document...",
        description: `Extracting text from ${file.name}`,
      });
      
      try {
        const extracted = await extractTextFromFile(file);
        
        if (extracted.error) {
          toast({
            title: "Extraction Warning",
            description: extracted.error,
            variant: "default",
          });
        }
        
        // Add document to context
        const documentId = await addDocument(file, extracted.text, extracted.html);
        
        logger.info('ContractReviewViewMulti', 'Document added', {
          id: documentId,
          name: file.name,
          type: detectDocumentType(file).type,
          size: file.size,
          pages: extracted.pages
        });
        
        toast({
          title: "Document loaded",
          description: `Successfully added ${file.name}`,
        });
      } catch (error: any) {
        console.error('Error processing file:', error);
        toast({
          title: "Error loading document",
          description: error.message || "Failed to extract text from document",
          variant: "destructive",
        });
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    
    // Create a synthetic event for reuse of handleFileChange logic
    const syntheticEvent = {
      target: { files },
    } as React.ChangeEvent<HTMLInputElement>;
    
    await handleFileChange(syntheticEvent);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const analyzeDocument = async (documentId: string) => {
    const document = getDocument(documentId);
    if (!document || !document.content) return;
    
    setIsAnalyzing(true);
    
    try {
      // Analyze with local engine
      const analysis = contractAnalyzer.current.analyzeContract(document.content);
      
      updateDocument(documentId, {
        violations: analysis.violations,
        confidence: analysis.confidence,
        riskScore: analysis.riskScore,
        hasAnalyzed: true,
      });
      
      logger.info('ContractReviewViewMulti', 'Analysis complete', {
        documentId,
        violationCount: analysis.violations.length,
        riskScore: analysis.riskScore,
        confidence: analysis.confidence
      });
      
      toast({
        title: "Analysis complete",
        description: `Found ${analysis.violations.length} potential issues`,
      });
    } catch (error: any) {
      console.error('Error analyzing document:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze document",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleComparisonToggle = () => {
    if (state.comparison.enabled) {
      disableComparison();
      setSelectedForComparison([]);
    } else if (selectedForComparison.length === 2) {
      enableComparison(selectedForComparison[0], selectedForComparison[1]);
    } else {
      toast({
        title: "Select two documents",
        description: "Please select exactly two documents to compare",
        variant: "default",
      });
    }
  };

  const toggleDocumentForComparison = (documentId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else if (prev.length < 2) {
        return [...prev, documentId];
      } else {
        // Replace the first selection
        return [prev[1], documentId];
      }
    });
  };

  const renderDocumentTabs = () => {
    if (state.documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-lg">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-2">No documents loaded</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
        </div>
      );
    }

    return (
      <Tabs value={state.activeDocumentId || undefined} onValueChange={setActiveDocument}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid grid-cols-auto gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(state.documents.length, 5)}, minmax(0, 1fr))` }}>
            {state.documents.map((doc) => (
              <TabsTrigger 
                key={doc.id} 
                value={doc.id}
                className="relative max-w-[200px]"
              >
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
                {doc.hasAnalyzed && (
                  <Badge 
                    variant={doc.violations.length > 0 ? "destructive" : "default"}
                    className="ml-2 px-1 py-0 text-xs"
                  >
                    {doc.violations.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            {state.documents.length >= 2 && (
              <Button
                onClick={handleComparisonToggle}
                variant={state.comparison.enabled ? "default" : "outline"}
                size="sm"
              >
                <Split className="h-4 w-4 mr-1" />
                {state.comparison.enabled ? "Exit Compare" : "Compare"}
              </Button>
            )}
          </div>
        </div>

        {state.documents.map((doc) => (
          <TabsContent key={doc.id} value={doc.id} className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{doc.name}</CardTitle>
                    <Badge variant="outline">{doc.type.toUpperCase()}</Badge>
                    {doc.metadata?.wordCount && (
                      <span className="text-sm text-muted-foreground">
                        {doc.metadata.wordCount} words
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!state.comparison.enabled && selectedForComparison.length > 0 && (
                      <Button
                        onClick={() => toggleDocumentForComparison(doc.id)}
                        variant={selectedForComparison.includes(doc.id) ? "default" : "outline"}
                        size="sm"
                      >
                        <FileCheck className="h-4 w-4 mr-1" />
                        {selectedForComparison.includes(doc.id) ? "Selected" : "Select"}
                      </Button>
                    )}
                    <Button
                      onClick={() => analyzeDocument(doc.id)}
                      disabled={isAnalyzing || !doc.content}
                      size="sm"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => removeDocument(doc.id)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Render document viewer based on type */}
                {doc.type === 'pdf' && doc.file ? (
                  <ContractDocumentInlinePDF
                    file={doc.file}
                    violations={doc.violations.map(v => ({
                      ...v,
                      clause: v.problematicText || v.description || '',
                      location: v.location || '',
                      suggestion: v.suggestion || '',
                      confidence: v.confidence || 0,
                      severity: (v.severity?.toUpperCase() || 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
                    }))}
                    selectedViolationId={state.selectedViolationId}
                    onViolationClick={(id: string) => updateState({ selectedViolationId: id })}
                  />
                ) : doc.type === 'docx' && doc.file ? (
                  <ContractDocumentInlineDOCX
                    file={doc.file}
                    violations={doc.violations.map(v => ({
                      ...v,
                      clause: v.problematicText || v.description || '',
                      location: v.location || '',
                      suggestion: v.suggestion || '',
                      confidence: v.confidence || 0,
                      severity: (v.severity?.toUpperCase() || 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
                    }))}
                    selectedViolationId={state.selectedViolationId}
                    onViolationClick={(id: string) => updateState({ selectedViolationId: id })}
                  />
                ) : (
                  <ContractDocumentInline
                    contractText={doc.content}
                    violations={doc.violations.map(v => ({
                      ...v,
                      clause: v.problematicText || v.description || '',
                      location: v.location || '',
                      suggestion: v.suggestion || '',
                      confidence: v.confidence || 0,
                      severity: (v.severity?.toUpperCase() || 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
                    }))}
                    selectedViolationId={state.selectedViolationId}
                    onViolationClick={(id: string) => updateState({ selectedViolationId: id })}
                  />
                )}
                
                {/* Analysis Results */}
                {doc.hasAnalyzed && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Risk Score</p>
                        <p className="text-2xl font-bold">
                          {doc.riskScore.toFixed(1)}/10
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Violations</p>
                        <p className="text-2xl font-bold">{doc.violations.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-2xl font-bold">{(doc.confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  const renderComparisonView = () => {
    if (!state.comparison.enabled || !state.comparison.documentIds) {
      return null;
    }

    const [doc1Id, doc2Id] = state.comparison.documentIds;
    const doc1 = getDocument(doc1Id);
    const doc2 = getDocument(doc2Id);

    if (!doc1 || !doc2) {
      return null;
    }

    // Prepare violations for the comparison view
    const allViolations = [
      ...doc1.violations.map(v => ({ 
        documentId: doc1Id,
        text: v.problematicText || v.description,
        severity: v.severity 
      })),
      ...doc2.violations.map(v => ({ 
        documentId: doc2Id,
        text: v.problematicText || v.description,
        severity: v.severity 
      }))
    ];

    return (
      <DocumentComparer
        document1={{
          id: doc1.id,
          name: doc1.name,
          content: doc1.content,
          type: doc1.type,
        }}
        document2={{
          id: doc2.id,
          name: doc2.name,
          content: doc2.content,
          type: doc2.type,
        }}
        onClose={() => disableComparison()}
        highlightViolations={allViolations.length > 0}
        violations={allViolations}
      />
    );
  };

  return (
    <div className="container mx-auto p-6" onDrop={handleDrop} onDragOver={handleDragOver}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.doc,.txt"
        multiple
      />
      
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contract Review System</h1>
        <div className="flex gap-2">
          <Badge variant="outline">
            {state.documents.length} document{state.documents.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            onClick={clearSession}
            variant="ghost"
            size="sm"
          >
            Clear Session
          </Button>
        </div>
      </div>
      
      {state.comparison.enabled ? renderComparisonView() : renderDocumentTabs()}
    </div>
  );
}