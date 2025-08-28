import { NextRequest, NextResponse } from 'next/server';
import { searchFARViolations, getAuburnPolicyContext, searchKnowledgeBase } from '@/lib/rag/rag-search';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

async function getRAGContext(userMessage: string): Promise<string> {
  try {
    console.log('🔍 [RAG] Getting context for:', userMessage.substring(0, 100));
    
    // Always search the full knowledge base for relevant content
    const kbResults = await searchKnowledgeBase(userMessage, 5);
    
    let ragContext = '';
    
    if (kbResults.length > 0) {
      console.log(`✅ [RAG] Found ${kbResults.length} relevant documents`);
      
      // Group results by document type for better organization
      const groupedResults: { [key: string]: any[] } = {};
      
      kbResults.forEach((result: any) => {
        const docType = result.document_type || 'general';
        if (!groupedResults[docType]) {
          groupedResults[docType] = [];
        }
        groupedResults[docType].push(result);
      });
      
      // Build context from grouped results
      for (const [docType, results] of Object.entries(groupedResults)) {
        const formattedType = docType.replace(/_/g, ' ').toUpperCase();
        ragContext += `\n${formattedType} CONTENT:\n`;
        
        results.forEach((result: any) => {
          const title = result.document_title || 'Document';
          const content = result.chunk_text || '';
          const similarity = result.similarity || 0;
          
          // Include more content for higher similarity matches
          const contentLength = similarity > 0.8 ? 500 : 300;
          ragContext += `\n[${title}] (Relevance: ${(similarity * 100).toFixed(1)}%):\n`;
          ragContext += `${content.substring(0, contentLength)}${content.length > contentLength ? '...' : ''}\n`;
        });
      }
    } else {
      console.log('⚠️ [RAG] No relevant documents found');
      
      // Fallback: Try broader search with key terms
      const keywords = userMessage.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 3)
        .join(' ');
      
      if (keywords) {
        console.log('🔄 [RAG] Trying broader search with:', keywords);
        const broadResults = await searchKnowledgeBase(keywords, 3);
        
        if (broadResults.length > 0) {
          ragContext = '\nRELATED KNOWLEDGE BASE CONTENT:\n';
          broadResults.forEach((result: any) => {
            ragContext += `\n[${result.document_title || 'Document'}]:\n`;
            ragContext += `${result.chunk_text?.substring(0, 200)}...\n`;
          });
        }
      }
    }
    
    // Also search for specific document types based on keywords
    const searchTerms = userMessage.toLowerCase();
    
    if (searchTerms.includes('vendor') || searchTerms.includes('agreement') || searchTerms.includes('form')) {
      const vendorResults = await searchKnowledgeBase('vendor agreement form Auburn University', 3);
      if (vendorResults.length > 0 && !ragContext.includes('VENDOR')) {
        ragContext += '\n\nVENDOR AGREEMENT INFORMATION:\n';
        vendorResults.forEach((result: any) => {
          ragContext += `${result.chunk_text?.substring(0, 300)}...\n`;
        });
      }
    }
    
    if (searchTerms.includes('terms') || searchTerms.includes('conditions')) {
      const termsResults = await searchKnowledgeBase('Auburn general terms and conditions contract', 3);
      if (termsResults.length > 0 && !ragContext.includes('TERMS')) {
        ragContext += '\n\nAUBURN TERMS & CONDITIONS:\n';
        termsResults.forEach((result: any) => {
          ragContext += `${result.chunk_text?.substring(0, 300)}...\n`;
        });
      }
    }
    
    console.log('📄 [RAG] Total context length:', ragContext.length, 'characters');
    return ragContext;
  } catch (error) {
    console.error('❌ [RAG] Error getting context:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 [/api/contract/chat] Request received at', new Date().toISOString());
  console.log('🔑 [/api/contract/chat] Environment check:', {
    hasKey: !!OPENROUTER_API_KEY,
    keyLength: OPENROUTER_API_KEY?.length,
    keyPrefix: OPENROUTER_API_KEY ? OPENROUTER_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    model: OPENROUTER_MODEL,
    nodeEnv: process.env.NODE_ENV
  });
  
  try {
    const body = await request.json();
    const { messages, model = OPENROUTER_MODEL } = body;
    
    console.log('📨 [/api/contract/chat] Request details:', {
      messagesCount: messages?.length,
      requestedModel: model,
      systemMessage: messages?.[0]?.content?.substring(0, 100) + '...',
      userMessage: messages?.[messages.length - 1]?.content
    });

    // Get the user's latest message
    const userMessage = messages?.[messages.length - 1]?.content || '';
    
    // Get RAG context for the user's question
    console.log('🔍 [/api/contract/chat] Fetching RAG context...');
    const ragContext = await getRAGContext(userMessage);
    
    if (ragContext) {
      console.log('✅ [/api/contract/chat] RAG context retrieved:', ragContext.substring(0, 200) + '...');
    }

    // Enhance the system message with RAG context
    const enhancedMessages = [...messages];
    if (enhancedMessages.length > 0 && enhancedMessages[0].role === 'system') {
      enhancedMessages[0].content = `You are an Auburn University contract compliance expert with access to Auburn's complete knowledge base.

IMPORTANT INSTRUCTIONS:
1. ALWAYS use the KNOWLEDGE BASE CONTEXT below to answer questions
2. When asked about specific forms, policies, or procedures, cite the exact content from the knowledge base
3. If the knowledge base contains relevant information, quote it directly
4. Never say you don't have access to information if it appears in the context below
5. Be specific and reference actual Auburn documents when available

KNOWLEDGE BASE CONTEXT (from Auburn's actual documents):
${ragContext || 'No specific context found in knowledge base.'}

CURRENT CONTRACT BEING REVIEWED:
${enhancedMessages[0].content}

Remember: You HAVE access to Auburn's vendor agreements, general terms and conditions, FAR matrix, and policy documents through the knowledge base context above. Use this information to provide accurate, specific answers.`;
    }

    if (!OPENROUTER_API_KEY) {
      console.warn('⚠️ [/api/contract/chat] No API key - using mock response');
      // Mock streaming response if no API key
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const mockResponse = `I understand you're asking about the contract. Based on my analysis and Auburn's knowledge base:

1. **Key Violations Found**: The contract contains several critical issues that need addressing, particularly around indemnification clauses and payment terms.

2. **Auburn Policy Compliance**: According to Auburn's Contract Management Guide, the university cannot provide indemnification as a state entity under Alabama law.

3. **FAR Compliance**: Per FAR 28.106, government entities have restrictions on indemnification that must be observed.

4. **Recommendations**: 
   - Replace indemnification language with mutual responsibility clauses
   - Adjust payment terms to NET 30 per Auburn policy
   - Preserve Auburn's publication rights
   - Ensure proper export control compliance per FAR 52.225

Would you like me to elaborate on any specific violation or provide alternative language suggestions from our approved templates?`;

          // Simulate streaming
          const words = mockResponse.split(' ');
          for (const word of words) {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({ 
                choices: [{ delta: { content: word + ' ' } }] 
              })}\n\n`
            );
            controller.enqueue(chunk);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Real OpenRouter streaming with RAG-enhanced context
    console.log('📡 [/api/contract/chat] Calling OpenRouter API with RAG context...');
    const requestBody = {
      model,
      messages: enhancedMessages,
      temperature: 0.5, // Lower for more focused responses
      max_tokens: 2000,
      stream: true,
      top_p: 0.9,
    };
    
    console.log('📤 [/api/contract/chat] OpenRouter request with RAG:', {
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
      stream: requestBody.stream,
      hasRAGContext: !!ragContext
    });
    
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Auburn Contract Chat',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 [/api/contract/chat] OpenRouter response:', {
      status: response.status,
      ok: response.ok,
      headers: {
        contentType: response.headers.get('content-type')
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [/api/contract/chat] OpenRouter error:', {
        status: response.status,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Chat API Error', 
          details: `Status ${response.status}: ${errorText || 'Unknown error'}`,
          suggestion: 'Please check your API key and try again'
        },
        { status: response.status }
      );
    }

    // Forward the streaming response
    const stream = response.body;
    if (!stream) {
      throw new Error('No response stream available');
    }

    console.log('✅ [/api/contract/chat] Streaming response to client');
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ [/api/contract/chat] Server error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}