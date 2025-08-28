// OpenRouter Streaming Client with Console Logging
export class OpenRouterStreamingClient {
  private apiKey: string;
  private model: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
    
    console.log('🔧 [OpenRouterStreamingClient] Initializing:', {
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey?.length,
      apiKeyPrefix: this.apiKey?.substring(0, 10),
      model: this.model,
      baseURL: this.baseURL
    });
  }

  async streamChat(messages: Array<{ role: string; content: string }>, options?: {
    temperature?: number;
    maxTokens?: number;
    onChunk?: (content: string) => void;
  }) {
    console.log('🌊 [OpenRouterStreamingClient] Starting stream with:', {
      messagesCount: messages.length,
      temperature: options?.temperature || 0.3,
      maxTokens: options?.maxTokens || 4000,
      model: this.model
    });

    const requestBody = {
      model: this.model,
      messages,
      stream: true,
      temperature: options?.temperature || 0.3,
      max_tokens: options?.maxTokens || 4000,
    };

    console.log('📤 [OpenRouterStreamingClient] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Auburn Contract Review System',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 [OpenRouterStreamingClient] Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [OpenRouterStreamingClient] API Error:', errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      return response;
    } catch (error) {
      console.error('❌ [OpenRouterStreamingClient] Stream error:', error);
      throw error;
    }
  }

  async processStream(response: Response, onChunk: (data: any) => void) {
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ [OpenRouterStreamingClient] No response body reader');
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;

    console.log('🎯 [OpenRouterStreamingClient] Starting to process stream...');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ [OpenRouterStreamingClient] Stream complete');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        chunkCount++;
        
        console.log(`📦 [OpenRouterStreamingClient] Chunk ${chunkCount}, size: ${chunk.length}`);

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine === '') continue;
          
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            
            if (data === '[DONE]') {
              console.log('🏁 [OpenRouterStreamingClient] Received [DONE] signal');
              onChunk({ type: 'done' });
              return;
            }

            if (data.startsWith(': ')) {
              // This is a comment (like ": OPENROUTER PROCESSING")
              console.log('💬 [OpenRouterStreamingClient] Comment:', data);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                console.log(`✍️ [OpenRouterStreamingClient] Content chunk: "${content.substring(0, 50)}..."`);
                onChunk({ type: 'content', content });
              }
            } catch (e) {
              console.warn('⚠️ [OpenRouterStreamingClient] Failed to parse:', data.substring(0, 100));
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ [OpenRouterStreamingClient] Processing error:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

// Helper function for direct streaming
export async function streamContractAnalysis(
  contractText: string,
  onUpdate: (data: any) => void
) {
  console.log('🚀 [streamContractAnalysis] Starting analysis...');
  
  const client = new OpenRouterStreamingClient();
  
  const systemPrompt = `You are an Auburn University contract review specialist. Analyze this contract for compliance issues.
Focus on:
- Indemnification clauses (Auburn cannot indemnify)
- IP rights (faculty must retain rights)
- Payment terms (need progress payments)
- Insurance (Auburn is self-insured)

Respond with a JSON array of issues found. Each issue should have:
{
  "type": "category",
  "severity": "HIGH/MEDIUM/LOW",
  "title": "brief title",
  "description": "explanation",
  "problematicText": "exact text",
  "suggestedAlternative": "replacement",
  "confidence": 85
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analyze this contract:\n\n${contractText.substring(0, 8000)}` }
  ];

  try {
    const response = await client.streamChat(messages);
    
    let fullContent = '';
    await client.processStream(response, (data) => {
      if (data.type === 'content') {
        fullContent += data.content;
        onUpdate({ type: 'progress', content: data.content });
        
        // Try to parse complete JSON if we have it
        if (fullContent.includes('[') && fullContent.includes(']')) {
          try {
            const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const issues = JSON.parse(jsonMatch[0]);
              console.log('📊 [streamContractAnalysis] Parsed issues:', issues.length);
              onUpdate({ type: 'issues', data: issues });
            }
          } catch (e) {
            // Still collecting JSON
          }
        }
      } else if (data.type === 'done') {
        console.log('✅ [streamContractAnalysis] Analysis complete');
        onUpdate({ type: 'complete' });
      }
    });
  } catch (error) {
    console.error('❌ [streamContractAnalysis] Error:', error);
    onUpdate({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}