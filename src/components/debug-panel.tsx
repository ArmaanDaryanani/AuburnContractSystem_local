"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Terminal, Trash2, Download, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "log" | "error" | "warn" | "info";
  source: string;
  message: string;
  details?: any;
}

export function DebugPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const captureLog = (type: LogEntry["type"], ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(" ");

      // Extract source from message if it has bracket notation
      const sourceMatch = message.match(/\[([^\]]+)\]/);
      const source = sourceMatch ? sourceMatch[1] : "System";

      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        type,
        source,
        message: message.replace(/\[[^\]]+\]/, "").trim(),
        details: args.length > 1 ? args.slice(1) : undefined
      };

      setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
    };

    console.log = (...args: any[]) => {
      originalLog(...args);
      captureLog("log", ...args);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      captureLog("error", ...args);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      captureLog("warn", ...args);
    };

    console.info = (...args: any[]) => {
      originalInfo(...args);
      captureLog("info", ...args);
    };

    // Log initial message
    console.log("🔧 [DebugPanel] Debug panel initialized and capturing logs");

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
    console.log("🗑️ [DebugPanel] Logs cleared");
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toISOString()}] [${log.type.toUpperCase()}] [${log.source}] ${log.message}`
    ).join("\n");
    
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = filter 
    ? logs.filter(log => 
        log.source.toLowerCase().includes(filter.toLowerCase()) ||
        log.message.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          size="sm"
          variant="outline"
          className="bg-white shadow-lg"
        >
          <Terminal className="h-4 w-4 mr-2" />
          Debug ({logs.length})
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[500px] max-h-[400px] flex flex-col">
      <Card className="shadow-2xl border-2 flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Debug Console
              <Badge variant="outline">{filteredLogs.length}</Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                onClick={exportLogs}
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Export logs"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                onClick={clearLogs}
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Clear logs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => setIsMinimized(true)}
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Minimize"
              >
                <EyeOff className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-2 px-2 py-1 text-xs border rounded w-full"
          />
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[300px] px-4 pb-4">
            <div className="space-y-1">
              {filteredLogs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  No logs captured yet. Interact with the app to see logs.
                </p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "text-xs font-mono p-2 rounded border",
                      log.type === "error" && "bg-red-50 border-red-200 text-red-900",
                      log.type === "warn" && "bg-yellow-50 border-yellow-200 text-yellow-900",
                      log.type === "info" && "bg-blue-50 border-blue-200 text-blue-900",
                      log.type === "log" && "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] px-1 py-0",
                          log.type === "error" && "border-red-500 text-red-700",
                          log.type === "warn" && "border-yellow-500 text-yellow-700",
                          log.type === "info" && "border-blue-500 text-blue-700",
                          log.type === "log" && "border-gray-500 text-gray-700"
                        )}
                      >
                        {log.type}
                      </Badge>
                      <span className="text-[10px] text-gray-500">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {log.source}
                      </Badge>
                    </div>
                    <div className="mt-1 break-all whitespace-pre-wrap">
                      {log.message}
                    </div>
                    {log.details && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-gray-600">
                          Show details
                        </summary>
                        <pre className="mt-1 text-[10px] overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}