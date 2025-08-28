import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase, getAuburnPolicyContext, searchFARViolations } from '@/lib/rag/rag-search';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

export async function POST(request: NextRequest) {
  console.log('📄 [/api/document-qa] Request received');
  
  try {
    const body = await request.json();
    const { question, documentText, fileName } = body;
    
    if (!question || !documentText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('🔍 [/api/document-qa] Processing:', {
      fileName,
      documentLength: documentText.length,
      question: question.substring(0, 100)
    });
    
    // Search for relevant context from knowledge base
    console.log('🔍 [/api/document-qa] Searching knowledge base...');
    const kbResults = await searchKnowledgeBase(question, 5);
    
    let ragContext = '';
    if (kbResults.length > 0) {
      ragContext = '\n\nRELEVANT KNOWLEDGE BASE CONTEXT:\n';
      kbResults.forEach((result: any) => {
        const source = result.document_type === 'far_matrix' ? 'FAR' : 
                       result.document_type === 'auburn_policy' ? 'Auburn Policy' : 'Knowledge Base';
        ragContext += `\n[${source}]: ${result.chunk_text?.substring(0, 300)}...\n`;
      });
    }
    
    // Build the prompt
    const systemPrompt = `You are an expert document analyst with access to Auburn University's policies and FAR regulations.

INSTRUCTIONS:
1. Answer the user's question about their document
2. Reference specific parts of the document when relevant
3. Also cite relevant Auburn policies or FAR regulations from the knowledge base
4. Be specific and helpful
5. Use markdown formatting for clarity

USER'S DOCUMENT:
${documentText.substring(0, 6000)}

KNOWLEDGE BASE CONTEXT:
${ragContext}

Remember to answer based on BOTH the user's document AND relevant policies/regulations.`;
    
    // Stream response from OpenRouter
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Document Q&A',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.3, // Lower temperature for more focused answers
        max_tokens: 2000,
        stream: true,
      }),
    });
    
    console.log('📥 [/api/document-qa] OpenRouter response:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [/api/document-qa] OpenRouter error:', errorText);
      
      // Fallback response without AI
      const fallbackResponse = `I can help analyze your document "${fileName || 'document'}".

Based on the text, I can see it contains information about: ${documentText.substring(0, 200)}...

To answer "${question}", I would need to analyze the document more thoroughly. Some relevant Auburn policies and FAR regulations may apply depending on the document type.`;
      
      // Create a streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunk = encoder.encode(
            `data: ${JSON.stringify({ 
              choices: [{ delta: { content: fallbackResponse } }] 
            })}\n\n`
          );
          controller.enqueue(chunk);
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
    
    // Forward the streaming response
    const stream = response.body;
    if (!stream) {
      throw new Error('No response stream available');
    }
    
    console.log('✅ [/api/document-qa] Streaming response to client');
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('❌ [/api/document-qa] Server error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}