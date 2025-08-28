#!/usr/bin/env node

// Test script to verify OpenRouter integration end-to-end
const API_KEY = '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';
const MODEL = 'google/gemini-2.5-flash-lite';
const BASE_URL = 'http://localhost:3006';

async function testDirectOpenRouter() {
  console.log('\n🔬 TEST 1: Direct OpenRouter API Call');
  console.log('=====================================');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': BASE_URL,
        'X-Title': 'Auburn Test'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Respond with: TEST SUCCESS' }],
        stream: false
      })
    });
    
    const data = await response.json();
    console.log('✅ Direct API Response:', data.choices?.[0]?.message?.content);
    console.log('📊 Tokens used:', data.usage);
  } catch (error) {
    console.error('❌ Direct API Error:', error.message);
  }
}

async function testAnalyzeEndpoint() {
  console.log('\n🔬 TEST 2: Analyze Endpoint');
  console.log('============================');
  
  try {
    const response = await fetch(`${BASE_URL}/api/contract/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Auburn shall indemnify contractor. Payment in 90 days.',
        fileName: 'test.txt',
        useAI: true
      })
    });
    
    const data = await response.json();
    console.log('✅ Analysis Response:');
    console.log('  - Violations found:', data.violations?.length || 0);
    console.log('  - Confidence:', data.confidence);
    console.log('  - Method:', data.method);
    
    if (data.violations?.[0]) {
      console.log('  - First violation:', data.violations[0].type);
    }
  } catch (error) {
    console.error('❌ Analyze Error:', error.message);
  }
}

async function testChatEndpoint() {
  console.log('\n🔬 TEST 3: Chat Endpoint (Streaming)');
  console.log('=====================================');
  
  try {
    const response = await fetch(`${BASE_URL}/api/contract/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are Auburn contract expert. Be specific.' },
          { role: 'user', content: 'Why cant Auburn indemnify?' }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let contentReceived = '';
    let chunkCount = 0;
    
    console.log('🌊 Streaming response...');
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunkCount++;
      buffer += decoder.decode(value, { stream: true });
      
      // Process lines
      while (true) {
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd === -1) break;
        
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              contentReceived += content;
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }
    
    console.log('✅ Chat Response received');
    console.log('  - Chunks:', chunkCount);
    console.log('  - Content length:', contentReceived.length);
    console.log('  - Preview:', contentReceived.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('❌ Chat Error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 OpenRouter Integration Test Suite');
  console.log('====================================');
  console.log('API Key:', API_KEY.substring(0, 20) + '...');
  console.log('Model:', MODEL);
  console.log('Base URL:', BASE_URL);
  
  await testDirectOpenRouter();
  await testAnalyzeEndpoint();
  await testChatEndpoint();
  
  console.log('\n✅ All tests complete!');
}

runAllTests().catch(console.error);