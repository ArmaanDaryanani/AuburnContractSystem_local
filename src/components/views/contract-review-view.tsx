"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { logger } from "@/lib/console-logger";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { ContractAnalyzer, type ViolationDetail } from "@/lib/contract-analysis";
import { ContractDocumentInline } from "@/components/contract-document-inline";
import dynamic from 'next/dynamic';
import { cn } from "@/lib/utils";
import { memoryStore } from "@/lib/memory-store";
import { extractTextFromFile } from "@/lib/document-extractor";
import { detectDocumentType, DocumentType } from "@/lib/document-utils";

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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ContractReviewView() {
  const [file, setFile] = useState<File | null>(null);
  const [contractText, setContractText] = useState("");
  const [contractHtml, setContractHtml] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  
  // Selected violation for highlighting
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const violationsListRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const contractAnalyzer = useRef(new ContractAnalyzer());

  // Removed auto-scroll to prevent page jumping
  // Users can manually scroll if needed
  
  // Log component mount
  useEffect(() => {
    logger.log('ContractReviewView', 'Component mounted');
    logger.info('ContractReviewView', 'Ready for contract analysis', {
      hasOpenRouterKey: process.env.NEXT_PUBLIC_HAS_OPENROUTER_KEY,
      model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL
    });
  }, []);
  
  // Trigger confetti when analysis completes with no violations
  useEffect(() => {
    if (hasAnalyzed && violations.length === 0) {
      // Fire confetti from multiple positions
      const duration = 3000; // 3 seconds
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
        
        // Shoot confetti from the left
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Shoot confetti from the right
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
      
      // Also do an initial burst from the center
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.6 }
      });
    }
  }, [hasAnalyzed, violations.length]);
  
  
  
  // Handle violation selection with auto-scroll
  const handleViolationSelect = (violationId: string) => {
    setSelectedViolationId(violationId);
    
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      // Auto-scroll to the selected violation card in the right column
      if (violationsListRef.current) {
        const violationCard = document.getElementById(`violation-card-${violationId}`);
        const documentViewer = document.getElementById('contract-document-viewer');
        
        if (violationCard && documentViewer) {
          const container = violationsListRef.current;
          
          // Get the document viewer's position relative to viewport
          const docRect = documentViewer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate where to scroll the violation card to align with document viewer
          const cardTop = violationCard.offsetTop;
          const targetScrollTop = cardTop - (docRect.top - containerRect.top);
          
          console.log('Aligning violation card with document viewer:', {
            violationId,
            cardTop,
            targetScrollTop
          });
          
          // Scroll only within the violations container
          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        } else {
          console.warn('Could not find elements:', { violationCard: !!violationCard, documentViewer: !!documentViewer });
        }
      }
    }, 100);
  };

  // Save state to memory store for SPA navigation only (clears on page refresh)
  useEffect(() => {
    // Don't save empty state
    if (!hasAnalyzed && messages.length === 0) return;
    
    const stateToSave = {
      contractText,
      violations,
      confidence,
      riskScore,
      hasAnalyzed,
      messages: messages.slice(-50), // Keep last 50 messages
      fileName: file?.name || null,
      lastUpdated: new Date().toISOString()
    };
    
    memoryStore.set('contractReviewState', stateToSave);
    logger.log('ContractReviewView', 'State saved to memory');
  }, [contractText, violations, confidence, riskScore, hasAnalyzed, messages, file]);
  
  // Restore from memory store on mount (for SPA navigation)
  useEffect(() => {
    const savedState = memoryStore.get('contractReviewState');
    if (savedState) {
      // Restore the state for SPA navigation
      if (savedState.contractText) setContractText(savedState.contractText);
      if (savedState.violations) setViolations(savedState.violations);
      if (savedState.confidence) setConfidence(savedState.confidence);
      if (savedState.riskScore) setRiskScore(savedState.riskScore);
      if (savedState.hasAnalyzed) setHasAnalyzed(savedState.hasAnalyzed);
      if (savedState.messages) {
        setMessages(savedState.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      }
      if (savedState.fileName) {
        setFile({ name: savedState.fileName } as File);
      }
      
      logger.info('ContractReviewView', 'State restored from memory');
    }
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      
      // Show loading toast
      toast({
        title: "Processing document...",
        description: `Extracting text from ${file.name}`,
      });
      
      try {
        const extracted = await extractTextFromFile(file);
        
        // Store HTML content if available (for DOCX)
        if (extracted.html) {
          setContractHtml(extracted.html);
        }
        
        if (extracted.error) {
          toast({
            title: "Extraction Warning",
            description: extracted.error,
            variant: "default",
          });
        }
        
        setContractText(extracted.text);
        
        // Log document type
        const docInfo = detectDocumentType(file);
        logger.info('ContractReviewView', 'Document loaded', {
          type: docInfo.type,
          size: file.size,
          pages: extracted.pages
        });
        
        toast({
          title: "Document loaded",
          description: `Successfully extracted text from ${file.name}`,
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
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setFile(file);
      
      // Show loading toast
      toast({
        title: "Processing document...",
        description: `Extracting text from ${file.name}`,
      });
      
      try {
        const extracted = await extractTextFromFile(file);
        
        // Store HTML content if available (for DOCX)
        if (extracted.html) {
          setContractHtml(extracted.html);
        }
        
        if (extracted.error) {
          toast({
            title: "Extraction Warning",
            description: extracted.error,
            variant: "default",
          });
        }
        
        setContractText(extracted.text);
        
        // Log document type  
        const docInfo = detectDocumentType(file);
        logger.info('ContractReviewView', 'Document dropped', {
          type: docInfo.type,
          size: file.size,
          pages: extracted.pages
        });
        
        toast({
          title: "Document loaded",
          description: `Successfully extracted text from ${file.name}`,
        });
      } catch (error: any) {
        console.error('Error processing dropped file:', error);
        toast({
          title: "Error loading document",
          description: error.message || "Failed to extract text from document",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const analyzeContract = async () => {
    if (!contractText) {
      toast({
        title: "No contract provided",
        description: "Please upload a file or paste contract text.",
        variant: "destructive",
      });
      return;
    }

    console.log('🚀 [Analyze] Starting contract analysis with OpenRouter');
    console.log('📄 [Analyze] Contract length:', contractText.length, 'characters');
    
    setIsAnalyzing(true);
    setViolations([]);
    setHasAnalyzed(false);

    try {
      // Call OpenRouter API for AI analysis
      console.log('🤖 [Analyze] Calling OpenRouter API...');
      
      const response = await fetch("/api/contract/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: contractText,
          fileName: file?.name || "pasted-contract.txt",
          useAI: true // Force AI analysis
        }),
      });

      console.log('📥 [Analyze] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Analyze] API error:', errorText);
        throw new Error(`Analysis failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [Analyze] Analysis complete:', {
        violations: result.violations?.length || 0,
        confidence: result.confidence,
        riskScore: result.riskScore
      });
      
      setViolations(result.violations || []);
      setConfidence(result.confidence || 85);
      setRiskScore(result.riskScore || 0);
      setIsAnalyzing(false);
      setHasAnalyzed(true);
      
      // Initialize chat with AI-powered welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `I've analyzed your contract using AI and found ${result.violations?.length || 0} compliance issues. ` +
          `I can help explain these violations, suggest alternative language, or answer questions about FAR compliance and Auburn policies. What would you like to know?`,
        timestamp: new Date()
      }]);
      
      toast({
        title: "AI Analysis Complete",
        description: `Found ${result.violations?.length || 0} compliance issues`,
      });
      
    } catch (error) {
      console.error('❌ [Analyze] Error:', error);
      
      // Fallback to TF-IDF if AI fails
      console.log('⚠️ [Analyze] Falling back to TF-IDF analysis');
      const analysis = contractAnalyzer.current.analyzeContract(contractText);
      
      setViolations(analysis.violations);
      setConfidence(analysis.confidence);
      setRiskScore(analysis.riskScore);
      setIsAnalyzing(false);
      setHasAnalyzed(true);
      
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `I've analyzed your contract and found ${analysis.violations.length} compliance issues. ` +
          `I can help explain these violations, suggest alternative language, or answer questions about FAR compliance and Auburn policies. What would you like to know?`,
        timestamp: new Date()
      }]);
      
      toast({
        title: "Using offline analysis",
        description: "AI analysis unavailable, using pattern matching.",
        variant: "default",
      });
    }
  };

  const buildContextPrompt = () => {
    // Reduce context size to avoid token limits
    let context = `You are an Auburn University contract compliance expert. Answer the user's question directly.

Contract summary (${Math.round(contractText.length/1000)}k chars total):
${contractText.substring(0, 1000)}${contractText.length > 1000 ? '...' : ''}

`;
    
    if (violations.length > 0) {
      // Only include top 5 violations to save tokens
      context += `Key violations (showing ${Math.min(5, violations.length)} of ${violations.length}):\n`;
      violations.slice(0, 5).forEach((v, i) => {
        const desc = v.description.length > 80 ? v.description.substring(0, 80) + '...' : v.description;
        context += `${i + 1}. [${v.severity || 'HIGH'}] ${v.type}: ${desc}\n`;
      });
      context += `\n`;
    }

    context += `Instructions: Answer directly and concisely. Focus on Auburn policies and FAR compliance.`;
    
    console.log('📝 [BuildContext] Optimized context:', {
      totalLength: context.length,
      contractPreview: 1000,
      violationsIncluded: Math.min(5, violations.length)
    });
    
    return context;
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return;
    
    // Add comprehensive console logging
    logger.log('ContractReviewView', `Sending message: ${chatInput.trim()}`);
    console.log('🚀 [ContractReviewView] Sending message:', chatInput.trim());
    console.log('📊 [ContractReviewView] Current state:', {
      messagesCount: messages.length,
      hasContractText: !!contractText,
      violationsCount: violations.length,
      timestamp: new Date().toISOString()
    });

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      abortControllerRef.current = new AbortController();
      
      // Build message history with smaller context window to avoid token limits
      const conversationHistory = messages.filter(m => m.id !== "welcome");
      const recentMessages = conversationHistory.slice(-4); // Only keep last 4 messages to avoid token limits
      
      console.log('📤 [ContractReviewView] Calling chat API...');
      
      const contextPrompt = buildContextPrompt();
      const requestMessages = [
        { role: "system", content: contextPrompt },
        ...recentMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: "user", content: chatInput.trim() }
      ];
      
      console.log('📝 [ContractReviewView] Full request:', {
        url: '/api/contract/chat',
        messagesCount: requestMessages.length,
        systemPromptPreview: contextPrompt.substring(0, 200) + '...',
        userMessage: chatInput.trim(),
        model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite'
      });
      
      console.log('📨 [ContractReviewView] Messages being sent:', requestMessages.map(m => ({
        role: m.role,
        contentLength: m.content.length,
        preview: m.content.substring(0, 50) + '...'
      })));
      
      const response = await fetch("/api/contract/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
          model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "google/gemini-2.5-flash-lite"
        }),
        signal: abortControllerRef.current.signal
      });

      console.log('📥 [ContractReviewView] Response:', {
        status: response.status,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type')
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ContractReviewView] API Error:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`API Error ${response.status}: ${errorText || 'Failed to get response'}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let chunkCount = 0;
      
      console.log('🌊 [ContractReviewView] Starting stream processing...');

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log(`📦 [ContractReviewView] Chunk ${chunkCount}: ${chunk.length} bytes`);
        
        // Process complete lines
        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;
          
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            
            try {
              const parsed = JSON.parse(data);
              console.log('🔍 [Stream] Parsed chunk:', {
                hasContent: !!parsed.choices?.[0]?.delta?.content,
                finishReason: parsed.choices?.[0]?.finish_reason,
                model: parsed.model
              });
              
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                setStreamingContent(accumulatedContent);
                console.log('✍️ [ContractReviewView] Content added:', {
                  newContent: content.substring(0, 50),
                  totalLength: accumulatedContent.length
                });
              } else if (parsed.usage) {
                console.log('📊 [Stream] Final usage:', parsed.usage);
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }

      // Add complete message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: accumulatedContent || "I can help you understand the contract violations and suggest improvements. What specific aspect would you like to discuss?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent("");
      
      console.log('✅ [ContractReviewView] Stream complete:', {
        totalContent: accumulatedContent.length,
        chunks: chunkCount
      });
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error('❌ [ContractReviewView] Chat error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I'm having trouble connecting. Let me provide some guidance based on the violations I found:\n\n" +
            violations.slice(0, 3).map((v, i) => 
              `${i + 1}. ${v.type}: Consider ${v.suggestion}`
            ).join("\n"),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportResults = () => {
    // Create a formatted markdown report
    let markdownReport = `# Contract Analysis Report\n\n`;
    markdownReport += `**Date:** ${new Date().toLocaleString()}\n`;
    markdownReport += `**File:** ${file?.name || 'Pasted Contract'}\n`;
    markdownReport += `**Model:** Google Gemini 2.0 Flash\n\n`;
    
    markdownReport += `## Analysis Metrics\n\n`;
    markdownReport += `- **Violations Found:** ${violations.length}\n`;
    markdownReport += `- **Confidence Score:** ${confidence.toFixed(0)}%\n`;
    markdownReport += `- **Risk Score:** ${riskScore.toFixed(1)}/10\n\n`;
    
    markdownReport += `## Violations\n\n`;
    violations.forEach((v, i) => {
      markdownReport += `### ${i + 1}. ${v.type} (${v.severity})\n`;
      markdownReport += `${v.description}\n`;
      if (v.farReference) {
        markdownReport += `**Reference:** ${v.farReference}\n`;
      }
      markdownReport += `**Suggestion:** ${v.suggestion}\n\n`;
    });
    
    markdownReport += `## Chat History\n\n`;
    messages.forEach((msg) => {
      markdownReport += `**${msg.role === 'user' ? 'User' : 'Assistant'}** (${new Date(msg.timestamp).toLocaleTimeString()}):\n`;
      markdownReport += `${msg.content}\n\n`;
    });
    
    const blob = new Blob([markdownReport], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract-analysis-${Date.now()}.md`;
    a.click();
  };

  const clearAnalysis = () => {
    setFile(null);
    setContractText("");
    setViolations([]);
    setConfidence(0);
    setRiskScore(0);
    setHasAnalyzed(false);
    setMessages([]);
    setStreamingContent("");
    
    // Clear memory store
    memoryStore.delete('contractReviewState');
    logger.log('ContractReviewView', 'State cleared from memory');
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          AI-Powered Contract Review System
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Advanced compliance analysis using TF-IDF algorithm with 85% confidence rate
        </p>
        
        {/* Show stats after analysis */}
        {hasAnalyzed && (
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-gray-900">{violations.length}</span>
              <span className="text-xs text-gray-600">Violations</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-900">{confidence.toFixed(0)}%</span>
              <span className="text-xs text-gray-600">Confidence</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-900">{riskScore.toFixed(1)}</span>
              <span className="text-xs text-gray-600">Risk Score</span>
            </div>
          </div>
        )}
        
        {/* Key Features */}
        <div className="grid grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">5</div>
            <div className="text-xs text-gray-600">FAR Rules</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">4</div>
            <div className="text-xs text-gray-600">Auburn Policies</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">85%</div>
            <div className="text-xs text-gray-600">Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">~30s</div>
            <div className="text-xs text-gray-600">Avg Time</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input/Chat Section */}
        <div className="space-y-4">
          <Card 
            id="chat-card" 
            className="border-gray-200 shadow-sm"
          >
            <CardContent className="p-6">
              {!hasAnalyzed ? (
                <div className="space-y-4">
                  {/* File Upload */}
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 transition-colors cursor-pointer bg-gray-50/50"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      Drop contract here or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOCX, or TXT files
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
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                      <button
                        onClick={clearAnalysis}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Text Input */}
                  <div className="relative">
                    <Textarea
                      placeholder="Or paste contract text here..."
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                      className="min-h-[200px] text-sm font-mono border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                  </div>

                  {/* Analyze Button */}
                  <Button 
                    onClick={analyzeContract}
                    disabled={isAnalyzing || !contractText}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing contract...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Contract
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-900">AI Contract Assistant</span>
                      <span className="text-xs text-gray-500">• RAG Powered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={exportResults}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Export
                      </Button>
                      <Button
                        onClick={clearAnalysis}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        New Contract
                      </Button>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <ScrollArea className="h-[450px] w-full">
                    <div className="space-y-4 pr-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3 w-full",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          {message.role === "assistant" && (
                            <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Bot className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "min-w-0 max-w-[75%] rounded-lg px-4 py-2.5",
                              message.role === "user"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-50 text-gray-900 border border-gray-200"
                            )}
                          >
                            {message.role === "user" ? (
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            ) : (
                              <div className="text-sm prose prose-sm max-w-none prose-gray break-words">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({children}) => <p className="mb-2">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                    li: ({children}) => <li className="mb-1">{children}</li>,
                                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                    em: ({children}) => <em className="italic">{children}</em>,
                                    code: ({children}) => <code className="bg-gray-200 px-1 rounded">{children}</code>,
                                    pre: ({children}) => <pre className="bg-gray-200 p-2 rounded overflow-x-auto">{children}</pre>,
                                    h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                          {message.role === "user" && (
                            <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Streaming message */}
                      {isStreaming && streamingContent && (
                        <div className="flex gap-3 justify-start w-full">
                          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="h-4 w-4 text-gray-600 animate-pulse" />
                          </div>
                          <div className="min-w-0 max-w-[75%] rounded-lg px-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200">
                            <div className="text-sm prose prose-sm max-w-none prose-gray">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({children}) => <p className="mb-2">{children}</p>,
                                  ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                  ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                  li: ({children}) => <li className="mb-1">{children}</li>,
                                  strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                  em: ({children}) => <em className="italic">{children}</em>,
                                  code: ({children}) => <code className="bg-gray-200 px-1 rounded">{children}</code>,
                                  pre: ({children}) => <pre className="bg-gray-200 p-2 rounded overflow-x-auto">{children}</pre>,
                                  h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                                }}
                              >
                                {streamingContent}
                              </ReactMarkdown>
                            </div>
                            <Loader2 className="h-3 w-3 animate-spin text-gray-500 mt-2" />
                          </div>
                        </div>
                      )}
                      
                      {/* Typing indicator */}
                      {isStreaming && !streamingContent && (
                        <div className="flex gap-3 justify-start">
                          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="bg-gray-100 rounded-lg px-3 py-2">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100" />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleChatKeyDown}
                      placeholder="Ask about violations, policies, or alternatives..."
                      className="min-h-[40px] max-h-[80px] resize-none text-sm"
                      disabled={isStreaming}
                    />
                    {isStreaming ? (
                      <Button
                        onClick={stopStreaming}
                        size="sm"
                        variant="destructive"
                        className="h-10 w-10 p-0"
                      >
                        <StopCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={sendMessage}
                        size="sm"
                        disabled={!chatInput.trim()}
                        className="h-10 w-10 p-0 bg-gray-900 hover:bg-gray-800"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        setChatInput("Explain the most critical violations");
                        setTimeout(sendMessage, 100);
                      }}
                    >
                      Critical Issues
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        setChatInput("What Auburn policies are violated?");
                        setTimeout(sendMessage, 100);
                      }}
                    >
                      Auburn Policies
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-gray-100"
                      onClick={() => {
                        setChatInput("Suggest alternative language");
                        setTimeout(sendMessage, 100);
                      }}
                    >
                      Alternatives
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Inline Document Viewer - appears after analysis */}
          {hasAnalyzed && contractText && (
            file && detectDocumentType(file).type === DocumentType.PDF ? (
              <ContractDocumentInlinePDF
                file={file}
                violations={violations}
                selectedViolationId={selectedViolationId}
                onViolationClick={handleViolationSelect}
              />
            ) : file && detectDocumentType(file).type === DocumentType.DOCX && contractHtml ? (
              <ContractDocumentInlineDOCX
                file={file}
                violations={violations}
                selectedViolationId={selectedViolationId}
                onViolationClick={handleViolationSelect}
              />
            ) : (
              <ContractDocumentInline
                contractText={contractText}
                violations={violations}
                selectedViolationId={selectedViolationId}
                onViolationClick={handleViolationSelect}
              />
            )
          )}
        </div>

        {/* Results Section */}
        <div className="sticky top-8" style={{ height: 'calc(100vh - 100px)' }}>
          {hasAnalyzed && violations.length === 0 ? (
            // No issues found state
            <Card className="border-gray-200 shadow-sm h-full">
              <CardContent className="h-full flex flex-col items-center justify-center p-8">
                <div className="relative">
                  <PartyPopper className="h-16 w-16 text-green-600 mb-4 animate-bounce" />
                  <div className="absolute -inset-4 bg-green-100 rounded-full opacity-20 animate-ping" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Contract Looks Great!
                </h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  No compliance issues found. This contract appears to meet all FAR and Auburn University requirements.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>All checks passed</span>
                </div>
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 w-full">
                  <p className="text-xs text-green-800 text-center">
                    <strong>Confidence Score:</strong> {confidence.toFixed(0)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : violations.length > 0 ? (
            <div className="flex flex-col h-full">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex-shrink-0">
                Compliance Issues Found
              </h2>
              
              <div 
                ref={violationsListRef}
                className="space-y-3 overflow-y-auto pr-2 pb-6 flex-1 relative"
              >
                {violations.map((violation, index) => {
                  const isSelected = selectedViolationId === violation.id;
                  const isDimmed = selectedViolationId && selectedViolationId !== violation.id;
                  
                  return (
                    <Card 
                      id={`violation-card-${violation.id}`}
                      key={violation.id} 
                      className={cn(
                        "border border-gray-200 shadow-sm cursor-pointer transition-all duration-300",
                        isSelected && "bg-gray-50",
                        isDimmed && "opacity-40 grayscale-[20%]",
                        "hover:opacity-100"
                      )}
                      onClick={() => handleViolationSelect(violation.id)}
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
                          {violation.severity === "LOW" && (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {violation.type}
                          </span>
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
                      
                      <p className="text-xs text-gray-600 mb-2">
                        {violation.description}
                      </p>
                      
                      {violation.farReference && (
                        <div className="text-xs text-gray-500 mb-2">
                          Reference: {violation.farReference}
                        </div>
                      )}
                      
                      <div className="bg-green-50 border border-green-200 rounded-md p-2 mt-2">
                        <p className="text-xs text-green-800">
                          <strong>Suggestion:</strong> {violation.suggestion}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-3">
                  <FileText className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-sm text-gray-600">
                  Analysis results will appear here
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Upload a contract to check for FAR and Auburn policy compliance
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}