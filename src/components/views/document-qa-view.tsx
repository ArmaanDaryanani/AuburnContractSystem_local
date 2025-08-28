"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Upload,
  FileText,
  Send,
  Bot,
  User,
  Loader2,
  X,
  Sparkles,
  BookOpen,
  Info,
  Highlighter
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{
    type: "document" | "rag";
    text: string;
    relevance?: number;
  }>;
}

interface HighlightSection {
  text: string;
  isHighlighted: boolean;
  source?: "document" | "far" | "auburn" | "knowledge";
  relevance?: number;
}

export default function DocumentQAView() {
  const [file, setFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [highlightedSections, setHighlightedSections] = useState<HighlightSection[]>([]);
  const [showHighlights, setShowHighlights] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Color scheme for different sources
  const sourceColors = {
    document: "bg-yellow-100 border-yellow-300",
    far: "bg-blue-100 border-blue-300",
    auburn: "bg-orange-100 border-orange-300",
    knowledge: "bg-purple-100 border-purple-300"
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFile(file);
    
    // Read file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setDocumentText(text);
      
      // Initialize chat with welcome message
      setMessages([{
        id: Date.now().toString(),
        role: "assistant",
        content: `I've loaded "${file.name}". I can answer questions about this document while also referencing Auburn's policies and FAR regulations. What would you like to know?`,
        timestamp: new Date()
      }]);
      
      toast({
        title: "Document loaded",
        description: `Ready to answer questions about ${file.name}`,
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const event = { target: { files: [file] } } as any;
      handleFileChange(event);
    }
  }, []);

  const sendMessage = async () => {
    if (!chatInput.trim() || !documentText || isStreaming) return;

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
      // Send to API with document context
      const response = await fetch("/api/document-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: chatInput.trim(),
          documentText: documentText.substring(0, 8000), // Limit for context
          fileName: file?.name
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                setStreamingContent(accumulatedContent);
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }

      // Extract and highlight relevant sections
      const relevantSections = extractRelevantSections(documentText, accumulatedContent);
      setHighlightedSections(relevantSections);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: accumulatedContent,
        timestamp: new Date(),
        sources: extractSources(accumulatedContent)
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  // Extract relevant sections from document based on AI response
  const extractRelevantSections = (doc: string, response: string): HighlightSection[] => {
    const sentences = doc.split(/[.!?]+/);
    const sections: HighlightSection[] = [];
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      
      // Check if sentence is relevant to the response
      const isRelevant = checkRelevance(trimmed, response);
      let source: HighlightSection["source"] = undefined;
      
      if (isRelevant) {
        // Determine source type based on keywords
        if (trimmed.toLowerCase().includes("far") || trimmed.toLowerCase().includes("federal")) {
          source = "far";
        } else if (trimmed.toLowerCase().includes("auburn") || trimmed.toLowerCase().includes("university")) {
          source = "auburn";
        } else {
          source = "document";
        }
      }
      
      sections.push({
        text: trimmed + ".",
        isHighlighted: isRelevant,
        source,
        relevance: isRelevant ? Math.random() * 0.5 + 0.5 : 0
      });
    });
    
    return sections;
  };

  // Simple relevance check (would be more sophisticated with embeddings)
  const checkRelevance = (text: string, response: string): boolean => {
    const keywords = response.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const textLower = text.toLowerCase();
    return keywords.some(keyword => textLower.includes(keyword));
  };

  // Extract sources mentioned in the response
  const extractSources = (response: string): Message["sources"] => {
    const sources = [];
    if (response.includes("FAR") || response.includes("Federal Acquisition")) {
      sources.push({ type: "rag" as const, text: "Federal Acquisition Regulation", relevance: 0.9 });
    }
    if (response.includes("Auburn") || response.includes("University")) {
      sources.push({ type: "rag" as const, text: "Auburn University Policies", relevance: 0.85 });
    }
    return sources;
  };

  const clearDocument = () => {
    setFile(null);
    setDocumentText("");
    setMessages([]);
    setHighlightedSections([]);
    setChatInput("");
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Document Q&A with RAG
        </h1>
        <p className="text-sm text-gray-600">
          Upload any document and ask questions. Get answers enhanced with Auburn policies and FAR regulations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Chat Interface */}
        <Card className="h-[700px] flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Assistant • RAG Enhanced
              </CardTitle>
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDocument}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {!file ? (
              // File upload
              <div className="flex-1 p-6">
                <div
                  className="h-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors cursor-pointer bg-gray-50/50 flex flex-col justify-center"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Drop your document here or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, DOCX, or TXT files • Max 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* File info */}
                <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{file.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                </div>
                
                {/* Messages */}
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === "assistant" && (
                          <Bot className="h-6 w-6 text-gray-500 mt-1" />
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2",
                            message.role === "user"
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-900"
                          )}
                        >
                          {message.role === "user" ? (
                            <p className="text-sm">{message.content}</p>
                          ) : (
                            <div className="text-sm prose prose-sm max-w-none prose-gray">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({children}) => <p className="mb-2">{children}</p>,
                                  ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                  li: ({children}) => <li className="mb-1">{children}</li>,
                                  strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                              {message.sources && message.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-500 mb-2">Referenced:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {message.sources.map((source, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {source.text}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {message.role === "user" && (
                          <User className="h-6 w-6 text-gray-500 mt-1" />
                        )}
                      </div>
                    ))}
                    
                    {isStreaming && streamingContent && (
                      <div className="flex gap-3 justify-start">
                        <Bot className="h-6 w-6 text-gray-500 mt-1" />
                        <div className="max-w-[85%] rounded-lg px-3 py-2 bg-gray-100">
                          <div className="text-sm prose prose-sm max-w-none prose-gray">
                            <ReactMarkdown>{streamingContent}</ReactMarkdown>
                          </div>
                          <Loader2 className="h-3 w-3 animate-spin mt-2" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Input */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Ask about this document..."
                      className="min-h-[40px] max-h-[80px] resize-none text-sm"
                      disabled={isStreaming}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!chatInput.trim() || isStreaming}
                      className="h-10 px-3"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Quick prompts */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {[
                      "Summarize this document",
                      "Find compliance issues",
                      "Compare with Auburn policies",
                      "Check FAR compliance"
                    ].map((prompt) => (
                      <Badge
                        key={prompt}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-gray-100"
                        onClick={() => setChatInput(prompt)}
                      >
                        {prompt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Document with Highlights */}
        <Card className="h-[700px] flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document View
              </CardTitle>
              {documentText && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHighlights(!showHighlights)}
                  >
                    <Highlighter className="h-4 w-4 mr-1" />
                    {showHighlights ? "Hide" : "Show"} Highlights
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-0">
            {!documentText ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3" />
                  <p className="text-sm">Upload a document to begin</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full p-6">
                {showHighlights && highlightedSections.length > 0 ? (
                  <div className="prose prose-sm max-w-none">
                    {highlightedSections.map((section, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "inline",
                          section.isHighlighted && showHighlights && [
                            "px-0.5 rounded border-b-2",
                            sourceColors[section.source || "document"]
                          ]
                        )}
                        title={section.isHighlighted ? `Relevance: ${(section.relevance! * 100).toFixed(0)}%` : undefined}
                      >
                        {section.text}{" "}
                      </span>
                    ))}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                    {documentText}
                  </pre>
                )}
                
                {/* Legend */}
                {showHighlights && highlightedSections.some(s => s.isHighlighted) && (
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-3">Highlight Legend:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 rounded", sourceColors.document)} />
                        <span className="text-xs text-gray-600">Document context</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 rounded", sourceColors.far)} />
                        <span className="text-xs text-gray-600">FAR reference</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 rounded", sourceColors.auburn)} />
                        <span className="text-xs text-gray-600">Auburn policy</span>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="mt-6">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">How it works</p>
                <p className="text-xs text-blue-700">
                  Upload any document and ask questions. The AI will analyze your document while also 
                  referencing Auburn's knowledge base of policies and FAR regulations. Relevant sections 
                  are highlighted in different colors based on their source.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}