"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memoryStore } from "@/lib/memory-store";
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set worker for PDF.js with CDN fallback
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}
import { 
  Database, 
  FileText, 
  BookOpen,
  Loader2,
  Send,
  Bot,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Upload,
  CheckCircle,
  Sparkles
} from "lucide-react";

interface Document {
  id: string;
  title: string;
  type: string;
  chunks: number;
  characterCount: number;
  status: string;
  content?: string;
  pages?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  pageReference?: number;
  highlights?: string[];
}

export default function KnowledgeBaseViewEnhanced() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedText, setUploadedText] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  
  // Chat states - Initialize from memory store
  const [messages, setMessages] = useState<Message[]>(() => {
    return memoryStore.get('knowledge-base-messages') || [];
  });
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);
  
  // Cleanup blob URL when component unmounts or PDF changes
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        console.log('Cleaning up PDF URL:', pdfUrl);
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Save messages to memory store
  useEffect(() => {
    if (messages.length > 0) {
      memoryStore.set('knowledge-base-messages', messages);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const fetchKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/knowledge-base');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setStatistics(data.statistics || {});
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    // Check if it's a PDF
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // Create object URL for PDF viewer
      const url = URL.createObjectURL(file);
      console.log('Created PDF URL:', url);
      console.log('File type:', file.type);
      console.log('File size:', file.size);
      setPdfUrl(url);
      setPdfCurrentPage(1);
      setNumPages(null); // Reset page count
      
      // Also try to extract text for Q&A
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/documents/extract-text', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const { text } = await response.json();
          setUploadedText(text);
        } else {
          setUploadedText("PDF loaded for viewing and Q&A.");
        }
      } catch (error) {
        console.error('Error extracting PDF text:', error);
        setUploadedText("PDF loaded for viewing and Q&A.");
      }
    } else {
      // For text files, read directly
      setPdfUrl(null);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setUploadedText(text);
      };
      reader.readAsText(file);
    }
    
    // Clear messages and show welcome message for uploaded doc
    setMessages([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I've loaded "${file.name}". What would you like to know about this document?`,
      timestamp: new Date()
    }]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const event = { target: { files: [file] } } as any;
      handleFileUpload(event);
    }
  };

  const clearUpload = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setUploadedFile(null);
    setUploadedText("");
    setMessages([]);
    setChatInput("");
    setPdfCurrentPage(1);
    setNumPages(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    setCurrentPage(1);
    
    // Fetch document content
    try {
      const response = await fetch(`/api/knowledge-base/document/${doc.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDocument({ ...doc, content: data.content });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
    
    // Set initial message
    setMessages([{
      id: Date.now().toString(),
      role: "assistant",
      content: `I'm ready to answer questions about "${doc.title}". What would you like to know?`,
      timestamp: new Date()
    }]);
  };

  const clearSelection = () => {
    setSelectedDocument(null);
    setMessages([]);
    setChatInput("");
    setCurrentPage(1);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return;

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
      
      let contextPrompt = "";
      
      if (uploadedFile) {
        // Handle uploaded document
        contextPrompt = `You are answering questions about the uploaded document "${uploadedFile.name}". Here is the document content:\n\n${uploadedText}\n\nBased on this document, answer the user's questions.`;
      } else if (selectedDocument) {
        // Handle selected indexed document
        contextPrompt = `You are answering questions about the document "${selectedDocument.title}". Only reference content from this specific document.`;
      } else {
        // General RAG chat
        contextPrompt = `You are answering questions about Auburn University's knowledge base containing FAR regulations, Auburn policies, and contract templates.`;
      }

      // Build conversation history for context
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // For PDFs, we need to handle them differently
      let requestBody: any = {
        query: userMessage.content,
        context: contextPrompt,
        documentFilter: selectedDocument?.id,
        useRAG: true,
        history: conversationHistory
      };

      // If we have an uploaded file, include its content
      if (uploadedFile) {
        if (uploadedFile.type === 'application/pdf') {
          // For PDFs, send the file itself if needed, or use extracted text
          requestBody.uploadedContent = uploadedText;
          requestBody.fileType = 'pdf';
          requestBody.fileName = uploadedFile.name;
        } else {
          requestBody.uploadedContent = uploadedText;
          requestBody.fileType = 'text';
        }
      }

      const response = await fetch("/api/contract-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.includes('[DONE]')) break;
          
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6).trim();
              
              // Skip JSON messages like {"type":"start","message":"..."}
              if (data.startsWith('{') && data.includes('"type"')) {
                continue; // Skip JSON control messages
              }
              
              // This is actual content text
              if (data && !data.startsWith('{')) {
                accumulatedContent += data;
                setStreamingContent(accumulatedContent);
              }
            } catch (e) {
              console.error('Streaming parse error:', e);
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: accumulatedContent || "I'll help you with that question.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error('Chat error:', error);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'far_matrix':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'auburn_policy':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'contract_template':
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return <Database className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl w-full mx-auto p-8 pb-32">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Knowledge Base
          </h1>
          <p className="text-sm text-gray-600">
            Document repository with {statistics?.totalChunks?.toLocaleString() || 0} indexed chunks
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold">{statistics?.totalDocuments || 0}</p>
              </div>
              <Database className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Chunks</p>
                <p className="text-2xl font-bold">{statistics?.totalChunks?.toLocaleString() || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">FAR Documents</p>
                <p className="text-2xl font-bold">{statistics?.documentTypes?.far_matrix || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auburn Policies</p>
                <p className="text-2xl font-bold">
                  {(statistics?.documentTypes?.auburn_policy || 0) + 
                   (statistics?.documentTypes?.approved_alternative || 0)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Document List */}
        <Card className="mb-6 bg-gradient-to-br from-gray-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-600" />
                Indexed Knowledge Base
              </CardTitle>
              <CardDescription>RAG-powered document repository for intelligent contract analysis</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
              <div className="text-xs text-gray-500">Documents</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {documents.map((doc) => {
              const getTypeLabel = (type: string) => {
                switch(type) {
                  case 'far_matrix': return 'Federal Regulation';
                  case 'auburn_policy': return 'Auburn Policy';
                  case 'contract_template': return 'Contract Template';
                  default: return 'Document';
                }
              };
              
              const getTypeColor = (type: string) => {
                switch(type) {
                  case 'far_matrix': return 'bg-blue-100 text-blue-700 border-blue-200';
                  case 'auburn_policy': return 'bg-orange-100 text-orange-700 border-orange-200';
                  case 'contract_template': return 'bg-green-100 text-green-700 border-green-200';
                  default: return 'bg-gray-100 text-gray-700 border-gray-200';
                }
              };
              
              return (
                <div
                  key={doc.id}
                  className="relative p-4 border border-gray-200 rounded-lg bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getDocumentIcon(doc.type)}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getTypeColor(doc.type)}`}>
                        {getTypeLabel(doc.type)}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-medium text-sm text-gray-900 mb-2">{doc.title}</h4>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">
                        <strong className="text-gray-700">{doc.chunks.toLocaleString()}</strong> chunks
                      </span>
                      {doc.characterCount && (
                        <span className="text-gray-500">
                          <strong className="text-gray-700">{(doc.characterCount / 1000).toFixed(0)}k</strong> chars
                        </span>
                      )}
                    </div>
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-700">
                <strong>AI-Ready:</strong> All documents are vectorized and indexed for semantic search. 
                Ask questions in the chat below to leverage the full knowledge base.
              </div>
            </div>
          </div>
        </CardContent>
        </Card>

        {/* RAG Chat Interface */}
        <Card className="h-[600px] mb-8">
        <CardContent className="p-0 h-full">
          {showDocumentUpload ? (
            // Split View: Chat + Document Upload
            <div className="grid grid-cols-2 h-full">
              {/* Left: Chat */}
              <div className="border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">Chat • Document Q&A</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowDocumentUpload(false);
                        clearUpload();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <Bot className="h-6 w-6 text-gray-500 mt-1" />
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {message.role === "user" ? (
                            message.content
                          ) : (
                            <div className="prose prose-sm max-w-none prose-gray">
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
                                  h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
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
                        <div className="max-w-[80%] rounded-lg px-3 py-2 bg-gray-100 text-sm">
                          <div className="prose prose-sm max-w-none prose-gray break-words">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <p className="mb-2 break-words">{children}</p>,
                                ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                li: ({children}) => <li className="mb-1 break-words">{children}</li>,
                                strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                                code: ({children}) => <code className="bg-gray-200 px-1 rounded text-xs break-all">{children}</code>,
                                pre: ({children}) => <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">{children}</pre>,
                                h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                              }}
                            >
                              {streamingContent}
                            </ReactMarkdown>
                          </div>
                          <Loader2 className="h-3 w-3 animate-spin inline-block mt-2" />
                        </div>
                      </div>
                    )}
                    
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
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
                      placeholder={uploadedFile ? `Ask about ${uploadedFile.name}...` : "Upload a document to start chatting..."}
                      className="min-h-[40px] max-h-[80px] resize-none text-sm"
                      disabled={isStreaming || !uploadedFile}
                    />
                    <Button
                      onClick={sendMessage}
                      size="sm"
                      disabled={!chatInput.trim() || isStreaming || !uploadedFile}
                      className="h-10 w-10 p-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Right: Document Upload/Viewer */}
              <div className="flex flex-col bg-gray-50">
                {uploadedFile ? (
                  <>
                    <div className="p-4 border-b border-gray-200 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">{uploadedFile.name}</h3>
                          <p className="text-xs text-gray-500">Uploaded Document</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearUpload}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                      {pdfUrl && uploadedFile?.type === 'application/pdf' ? (
                        <div className="flex flex-col h-full">
                          <div className="flex justify-center items-center mb-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPdfCurrentPage(Math.max(1, pdfCurrentPage - 1))}
                              disabled={pdfCurrentPage <= 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600 px-3">
                              Page {pdfCurrentPage} of {numPages || '...'}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPdfCurrentPage(Math.min(numPages, pdfCurrentPage + 1))}
                              disabled={pdfCurrentPage >= numPages}
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex-1 overflow-auto bg-gray-100 rounded-lg flex justify-center">
                            <PDFDocument
                              file={pdfUrl}
                              onLoadSuccess={({ numPages }) => {
                                console.log('PDF loaded successfully with', numPages, 'pages');
                                setNumPages(numPages);
                              }}
                              onLoadError={(error) => {
                                console.error('PDF loading error:', error);
                                // Fallback to text display if PDF fails
                                setPdfUrl(null);
                              }}
                              loading={
                                <div className="flex items-center justify-center p-8">
                                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                </div>
                              }
                              error={
                                <div className="flex flex-col items-center justify-center p-8 text-red-600">
                                  <p className="text-sm font-medium">Failed to load PDF file.</p>
                                  <p className="text-xs mt-2">Displaying extracted text instead.</p>
                                </div>
                              }
                              className="max-w-full"
                            >
                              <Page
                                pageNumber={pdfCurrentPage}
                                className="shadow-lg"
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                width={400}
                              />
                            </PDFDocument>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg p-8 shadow-sm min-h-full">
                          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                            {uploadedText || "Processing document..."}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="w-full max-w-md"
                    >
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Upload Your Document
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Drag and drop a file here, or click to browse
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.pdf,.docx,.doc"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose File
                        </Button>
                        <p className="text-xs text-gray-500 mt-4">
                          Supported formats: TXT, PDF, DOCX
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : selectedDocument ? (
            // Split View: Chat + Document Viewer
            <div className="grid grid-cols-2 h-full">
              {/* Left: Chat */}
              <div className="border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">Chat • RAG Powered</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <Bot className="h-6 w-6 text-gray-500 mt-1" />
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {message.role === "user" ? (
                            message.content
                          ) : (
                            <div className="prose prose-sm max-w-none prose-gray">
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
                                  h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
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
                        <div className="max-w-[80%] rounded-lg px-3 py-2 bg-gray-100 text-sm">
                          <div className="prose prose-sm max-w-none prose-gray break-words">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <p className="mb-2 break-words">{children}</p>,
                                ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                li: ({children}) => <li className="mb-1 break-words">{children}</li>,
                                strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                                code: ({children}) => <code className="bg-gray-200 px-1 rounded text-xs break-all">{children}</code>,
                                pre: ({children}) => <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">{children}</pre>,
                                h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                              }}
                            >
                              {streamingContent}
                            </ReactMarkdown>
                          </div>
                          <Loader2 className="h-3 w-3 animate-spin inline-block mt-2" />
                        </div>
                      </div>
                    )}
                    
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
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
                      placeholder={`Ask about ${selectedDocument.title}...`}
                      className="min-h-[40px] max-h-[80px] resize-none text-sm"
                      disabled={isStreaming}
                    />
                    <Button
                      onClick={sendMessage}
                      size="sm"
                      disabled={!chatInput.trim() || isStreaming}
                      className="h-10 w-10 p-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Right: Document Viewer */}
              <div className="flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{selectedDocument.title}</h3>
                      <p className="text-xs text-gray-500">
                        Page {currentPage} of {selectedDocument.pages || 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(selectedDocument.pages || 1, currentPage + 1))}
                        disabled={currentPage >= (selectedDocument.pages || 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="bg-white rounded-lg p-8 shadow-sm min-h-full">
                    {selectedDocument.content ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Showing extracted text from {selectedDocument.title}. 
                            The original PDF/DOCX file would need to be stored separately for full document viewing.
                          </p>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                          {selectedDocument.content}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    )}
                    
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Full Width: General Chat
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium">Knowledge Base Assistant • RAG Powered</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDocumentUpload(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Chat With Your Documents
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Ask about Auburn's Knowledge Base
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        I can help you explore FAR regulations, Auburn policies, and contract templates.
                      </p>
                      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                        {[
                          "What are Auburn's indemnification policies?",
                          "Explain FAR termination clauses",
                          "What are the standard payment terms?",
                          "Show me export control requirements"
                        ].map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setChatInput(suggestion)}
                            className="text-left p-3 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <Bot className="h-6 w-6 text-gray-500 mt-1" />
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              message.role === "user"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            {message.role === "user" ? (
                              message.content
                            ) : (
                              <div className="prose prose-sm max-w-none prose-gray break-words">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({children}) => <p className="mb-2 break-words">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                    li: ({children}) => <li className="mb-1 break-words">{children}</li>,
                                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                    em: ({children}) => <em className="italic">{children}</em>,
                                    code: ({children}) => <code className="bg-gray-200 px-1 rounded text-xs break-all">{children}</code>,
                                    pre: ({children}) => <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-xs">{children}</pre>,
                                    h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                          {message.role === "user" && (
                            <User className="h-6 w-6 text-gray-500 mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <Bot className="h-6 w-6 text-gray-500 mt-1" />
                      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100">
                        <div className="prose prose-sm max-w-none prose-gray">
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
                              h3: ({children}) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                            }}
                          >
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                        <Loader2 className="h-3 w-3 animate-spin inline-block mt-2" />
                      </div>
                    </div>
                  )}
                  
                  {/* Typing indicator */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <Bot className="h-6 w-6 text-gray-500 mt-1" />
                      <div className="bg-gray-100 rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-100">
                <div className="max-w-2xl mx-auto flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask about FAR regulations, Auburn policies, or contract requirements..."
                    className="min-h-[40px] max-h-[80px] resize-none"
                    disabled={isStreaming}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || isStreaming}
                    className="h-10 px-4"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}