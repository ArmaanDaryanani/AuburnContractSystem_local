"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Loader2, 
  Bot, 
  User, 
  StopCircle,
  Sparkles,
  MessageSquare,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ContractChatProps {
  contractText: string;
  violations?: any[];
  isOpen: boolean;
  onClose: () => void;
}

export function ContractChat({ contractText, violations = [], isOpen, onClose }: ContractChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI contract analyst. I can help you understand this contract, explain violations, suggest alternatives, and answer any questions about FAR compliance and Auburn policies. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const buildContextPrompt = () => {
    let context = `You are an expert contract analyst for Auburn University. You are reviewing the following contract:\n\n${contractText.substring(0, 3000)}...\n\n`;
    
    if (violations.length > 0) {
      context += `The following violations were detected:\n`;
      violations.forEach((v, i) => {
        context += `${i + 1}. ${v.type}: ${v.description}\n`;
      });
      context += `\n`;
    }

    context += `Please provide helpful, specific answers about this contract, FAR compliance, Auburn policies, and suggested improvements. Be concise but thorough.`;
    
    return context;
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    // Client-side console logging (visible in browser console)
    console.log('🚀 [ContractChat] Sending message:', input.trim());
    console.log('📊 [ContractChat] Current state:', {
      messagesCount: messages.length,
      isStreaming,
      hasInput: !!input.trim(),
      timestamp: new Date().toISOString()
    });

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    // Create new message for assistant
    const assistantMessageId = (Date.now() + 1).toString();

    try {
      abortControllerRef.current = new AbortController();
      
      const apiUrl = "/api/contract/chat";
      console.log('📤 [ContractChat] Calling chat API:', apiUrl);
      console.log('📦 [ContractChat] Request payload:', {
        messagesCount: messages.length,
        contextPromptLength: buildContextPrompt().length,
        model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "google/gemini-2.5-flash-lite"
      });
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: buildContextPrompt() },
            ...messages.filter(m => m.id !== "welcome").map(m => ({
              role: m.role,
              content: m.content
            })),
            { role: "user", content: input.trim() }
          ],
          model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "google/gemini-2.5-flash-lite"
        }),
        signal: abortControllerRef.current.signal
      });

      console.log('📥 [ContractChat] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          cacheControl: response.headers.get('cache-control')
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ContractChat] API error:', {
          status: response.status,
          statusText: response.statusText,
          errorDetails: errorText
        });
        throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let chunkCount = 0;

      console.log('🌊 [ContractChat] Starting to read stream...');

      while (reader) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ [ContractChat] Stream complete');
          break;
        }

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        console.log(`📦 [ContractChat] Chunk ${chunkCount} received, buffer size: ${buffer.length}`);
        
        // Process complete lines
        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;
          
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            console.log('📄 [ContractChat] Data line:', data.substring(0, 100));
            
            if (data === "[DONE]") {
              console.log('🏁 [ContractChat] Received [DONE]');
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                setStreamingContent(accumulatedContent);
                console.log('✍️ [ContractChat] Content added:', {
                  newContentLength: content.length,
                  totalLength: accumulatedContent.length,
                  preview: content.substring(0, 50)
                });
              } else {
                console.log('📭 [ContractChat] Empty content in parsed data:', parsed);
              }
            } catch (e) {
              console.warn('⚠️ [ContractChat] Failed to parse JSON:', e);
            }
          }
        }
      }

      // Add complete message
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: accumulatedContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent("");
      
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log('🛑 [ContractChat] Stream cancelled by user');
      } else {
        console.error('❌ [ContractChat] Chat error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        // Add error message
        const errorMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again or rephrase your question.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 w-[450px] h-[600px] flex flex-col bg-white rounded-t-lg shadow-2xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Contract AI Assistant</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-600">Online</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
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
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-900"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-60 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </span>
              </div>
              {message.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          
          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-gray-600 animate-pulse" />
              </div>
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                <Loader2 className="h-3 w-3 animate-spin text-gray-500 mt-2" />
              </div>
            </div>
          )}
          
          {/* Typing indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 flex-wrap">
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-gray-100"
            onClick={() => setInput("Explain the main violations in this contract")}
          >
            Explain violations
          </Badge>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-gray-100"
            onClick={() => setInput("What are the Auburn policy concerns?")}
          >
            Auburn policies
          </Badge>
          <Badge 
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-gray-100"
            onClick={() => setInput("Suggest alternative language for the indemnification clause")}
          >
            Alternatives
          </Badge>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this contract..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-gray-400"
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
              disabled={!input.trim()}
              className="h-10 w-10 p-0 bg-gray-900 hover:bg-gray-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Powered by DeepSeek via OpenRouter • Press Enter to send
        </p>
      </div>
    </div>
  );
}