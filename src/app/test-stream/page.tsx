"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Brain, Send, AlertCircle, CheckCircle } from 'lucide-react';

export default function TestStreamPage() {
  const [contractText, setContractText] = useState(`Auburn University shall indemnify and hold harmless the Sponsor from any claims.
All intellectual property created under this agreement shall belong exclusively to the Sponsor.
Payment will be made upon completion of all deliverables.
Auburn must maintain $5 million in liability insurance.`);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const testStream = async () => {
    console.log('🚀 [test-stream] Starting test...');
    setIsStreaming(true);
    setError(null);
    setIssues([]);
    setMessages([]);
    
    try {
      // First test the endpoint
      console.log('🧪 [test-stream] Testing endpoint availability...');
      const testResponse = await fetch('/api/contract-stream');
      const testData = await testResponse.json();
      console.log('📊 [test-stream] Endpoint test:', testData);
      
      if (!testData.hasApiKey) {
        throw new Error('API key not configured');
      }
      
      // Now test streaming
      console.log('📤 [test-stream] Sending contract for analysis...');
      const response = await fetch('/api/contract-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: contractText,
          fileName: 'test-contract.txt'
        }),
      });

      console.log('📥 [test-stream] Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [test-stream] Error response:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let lineCount = 0;

      console.log('🌊 [test-stream] Starting to read stream...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ [test-stream] Stream complete');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log(`📦 [test-stream] Chunk received, size: ${chunk.length}`);
        buffer += chunk;

        // Process lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          lineCount++;
          const trimmedLine = line.trim();
          
          console.log(`📄 [test-stream] Line ${lineCount}:`, trimmedLine.substring(0, 200));
          
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            
            if (data === '[DONE]') {
              console.log('🏁 [test-stream] Received [DONE]');
              setMessages(prev => [...prev, '✅ Analysis complete!']);
              break;
            }

            try {
              const parsed = JSON.parse(data);
              console.log('📊 [test-stream] Parsed data:', parsed);
              
              switch (parsed.type) {
                case 'start':
                case 'progress':
                  setMessages(prev => [...prev, parsed.message]);
                  break;
                case 'issue':
                  setIssues(prev => [...prev, parsed.data]);
                  break;
                case 'complete':
                  setMessages(prev => [...prev, `Found ${parsed.summary.totalIssues} issues`]);
                  break;
                case 'error':
                  throw new Error(parsed.message);
              }
            } catch (e) {
              console.warn('⚠️ [test-stream] Parse error:', e, 'for line:', data);
            }
          }
        }
      }

    } catch (err) {
      console.error('❌ [test-stream] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Brain className="w-8 h-8" />
        OpenRouter Streaming Test
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Enter contract text..."
                rows={10}
                className="font-mono text-sm"
              />
              <Button 
                onClick={testStream} 
                disabled={isStreaming}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {isStreaming ? 'Streaming...' : 'Test Stream'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Console Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div key={idx} className="text-sm text-gray-600">
                    {msg}
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-gray-400">No messages yet...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Issues Found ({issues.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {issues.map((issue, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <Badge variant={
                      issue.severity === 'HIGH' ? 'destructive' :
                      issue.severity === 'MEDIUM' ? 'secondary' : 'outline'
                    }>
                      {issue.severity}
                    </Badge>
                    {issue.confidence && (
                      <Badge variant="outline">{issue.confidence}%</Badge>
                    )}
                  </div>
                  <h4 className="font-semibold">{issue.title}</h4>
                  <p className="text-sm text-gray-600">{issue.description}</p>
                  {issue.problematicText && (
                    <div className="bg-red-50 p-2 rounded text-xs">
                      "{issue.problematicText}"
                    </div>
                  )}
                  {issue.suggestedAlternative && (
                    <div className="bg-green-50 p-2 rounded text-xs">
                      ✓ {issue.suggestedAlternative}
                    </div>
                  )}
                </div>
              ))}
              {issues.length === 0 && !isStreaming && (
                <p className="text-gray-400 text-center py-8">
                  No issues found yet. Click "Test Stream" to analyze.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Debug Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Debug Console</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
            {`// Check browser console for detailed logs
// All console.log statements will appear there
// Press F12 to open DevTools

Current State:
- Streaming: ${isStreaming}
- Issues Found: ${issues.length}
- Messages: ${messages.length}
- Error: ${error || 'None'}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}