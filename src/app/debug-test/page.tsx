"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Terminal, Send } from 'lucide-react';
import { DebugPanel } from '@/components/debug-panel';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
}

export default function DebugTestPage() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Environment Variables', status: 'pending' },
    { name: 'OpenRouter API Connection', status: 'pending' },
    { name: 'Streaming Response', status: 'pending' },
    { name: 'Contract Analysis', status: 'pending' }
  ]);

  const runTests = async () => {
    console.log('🧪 [DebugTest] Starting comprehensive tests...');
    
    // Test 1: Environment Variables
    setTests(prev => prev.map(t => 
      t.name === 'Environment Variables' ? { ...t, status: 'running' } : t
    ));
    
    console.log('📋 [DebugTest] Test 1: Checking environment variables...');
    try {
      const envResponse = await fetch('/api/test-openrouter');
      const envData = await envResponse.json();
      
      console.log('✅ [DebugTest] Environment check result:', envData);
      
      setTests(prev => prev.map(t => 
        t.name === 'Environment Variables' 
          ? { 
              ...t, 
              status: envData.hasApiKey ? 'success' : 'error',
              message: envData.hasApiKey 
                ? `API key configured (${envData.model})`
                : 'No API key found',
              details: envData
            } 
          : t
      ));
    } catch (error) {
      console.error('❌ [DebugTest] Environment check failed:', error);
      setTests(prev => prev.map(t => 
        t.name === 'Environment Variables' 
          ? { ...t, status: 'error', message: String(error) } 
          : t
      ));
    }

    // Test 2: OpenRouter API Connection
    setTests(prev => prev.map(t => 
      t.name === 'OpenRouter API Connection' ? { ...t, status: 'running' } : t
    ));
    
    console.log('🌐 [DebugTest] Test 2: Testing OpenRouter API connection...');
    try {
      const response = await fetch('/api/contract/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Say "Hello from OpenRouter" in exactly 5 words.' }
          ]
        })
      });

      if (response.ok) {
        console.log('✅ [DebugTest] OpenRouter connection successful');
        
        // Try to read the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            content += chunk;
            
            // Log first chunk for debugging
            if (content.length < 200) {
              console.log('📦 [DebugTest] Stream chunk:', chunk.substring(0, 100));
            }
          }
        }
        
        setTests(prev => prev.map(t => 
          t.name === 'OpenRouter API Connection' 
            ? { 
                ...t, 
                status: 'success',
                message: 'Connection established successfully',
                details: { streamLength: content.length }
              } 
            : t
        ));
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [DebugTest] OpenRouter connection failed:', error);
      setTests(prev => prev.map(t => 
        t.name === 'OpenRouter API Connection' 
          ? { ...t, status: 'error', message: String(error) } 
          : t
      ));
    }

    // Test 3: Streaming Response
    setTests(prev => prev.map(t => 
      t.name === 'Streaming Response' ? { ...t, status: 'running' } : t
    ));
    
    console.log('🌊 [DebugTest] Test 3: Testing streaming response...');
    try {
      const response = await fetch('/api/contract-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'This contract requires indemnification from Auburn.',
          fileName: 'test.txt'
        })
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              eventCount++;
              console.log(`📨 [DebugTest] Stream event ${eventCount}:`, line.substring(6, 100));
            }
          }
        }
        
        console.log(`✅ [DebugTest] Streaming complete, ${eventCount} events received`);
        setTests(prev => prev.map(t => 
          t.name === 'Streaming Response' 
            ? { 
                ...t, 
                status: 'success',
                message: `Received ${eventCount} streaming events`,
                details: { eventCount }
              } 
            : t
        ));
      } else {
        throw new Error(`Stream returned status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [DebugTest] Streaming test failed:', error);
      setTests(prev => prev.map(t => 
        t.name === 'Streaming Response' 
          ? { ...t, status: 'error', message: String(error) } 
          : t
      ));
    }

    // Test 4: Contract Analysis
    setTests(prev => prev.map(t => 
      t.name === 'Contract Analysis' ? { ...t, status: 'running' } : t
    ));
    
    console.log('📄 [DebugTest] Test 4: Testing contract analysis...');
    try {
      const testContract = `
        INDEMNIFICATION: Auburn University shall indemnify and hold harmless the Sponsor.
        PAYMENT TERMS: Payment upon completion of deliverables.
        INTELLECTUAL PROPERTY: All IP created belongs to Sponsor.
      `;
      
      const response = await fetch('/api/contract/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testContract,
          fileName: 'test-contract.txt'
        })
      });

      const result = await response.json();
      console.log('📊 [DebugTest] Analysis result:', result);
      
      if (result.violations && result.violations.length > 0) {
        console.log(`✅ [DebugTest] Found ${result.violations.length} violations`);
        setTests(prev => prev.map(t => 
          t.name === 'Contract Analysis' 
            ? { 
                ...t, 
                status: 'success',
                message: `Found ${result.violations.length} violations`,
                details: result
              } 
            : t
        ));
      } else {
        throw new Error('No violations detected in problematic contract');
      }
    } catch (error) {
      console.error('❌ [DebugTest] Contract analysis failed:', error);
      setTests(prev => prev.map(t => 
        t.name === 'Contract Analysis' 
          ? { ...t, status: 'error', message: String(error) } 
          : t
      ));
    }

    console.log('🏁 [DebugTest] All tests completed');
  };

  useEffect(() => {
    console.log('🚀 [DebugTest] Debug test page loaded');
    console.log('📍 [DebugTest] Current URL:', window.location.href);
    console.log('🌐 [DebugTest] Browser info:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    });
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            OpenRouter Debug & Testing Suite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This page tests the OpenRouter integration and streaming functionality.
              Open your browser's developer console (F12) to see detailed logs.
            </AlertDescription>
          </Alert>

          <Button onClick={runTests} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Run All Tests
          </Button>

          <div className="space-y-3">
            {tests.map((test) => (
              <Card key={test.name}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {test.status === 'pending' && <XCircle className="h-5 w-5 text-gray-400" />}
                      {test.status === 'running' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                      {test.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {test.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                      <span className="font-medium">{test.name}</span>
                    </div>
                    <Badge variant={
                      test.status === 'success' ? 'default' :
                      test.status === 'error' ? 'destructive' :
                      test.status === 'running' ? 'secondary' : 'outline'
                    }>
                      {test.status}
                    </Badge>
                  </div>
                  {test.message && (
                    <p className="text-sm text-gray-600 mt-2">{test.message}</p>
                  )}
                  {test.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600">Show details</summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Alert>
            <AlertDescription>
              <strong>Troubleshooting:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check the browser console (F12) for detailed logs</li>
                <li>Check the terminal running "npm run dev" for server-side logs</li>
                <li>Ensure .env.local has OPENROUTER_API_KEY set</li>
                <li>The debug panel below shows captured console logs</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
      <DebugPanel />
    </div>
  );
}