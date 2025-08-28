import { NextRequest } from 'next/server';
import { OpenRouterStreamingClient } from '@/lib/openrouter-streaming';

export async function POST(request: NextRequest) {
  console.log('🚀 [/api/contract-stream] Received request');
  
  try {
    const body = await request.json();
    const { text, fileName } = body;
    
    console.log('📄 [/api/contract-stream] Processing:', {
      fileName,
      textLength: text?.length,
      hasText: !!text
    });

    if (!text) {
      console.error('❌ [/api/contract-stream] No text provided');
      return new Response(
        JSON.stringify({ error: 'No contract text provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new OpenRouterStreamingClient();
    
    // Auburn-specific system prompt
    const systemPrompt = `You are an Auburn University contract review AI. Analyze contracts for compliance with Auburn policies and FAR regulations.

KEY POLICIES:
- Auburn cannot provide indemnification (state entity restriction)
- Faculty retain intellectual property rights
- Progress payments required (not milestone-based)
- Auburn is self-insured through the State of Alabama
- Must comply with state procurement laws

Analyze the contract and return a JSON array of issues. Each issue should have:
{
  "type": "indemnification/ip/payment/insurance/compliance",
  "severity": "HIGH/MEDIUM/LOW",
  "title": "Brief descriptive title",
  "description": "Detailed explanation of the issue",
  "problematicText": "The exact problematic text from contract",
  "location": "Section/paragraph where found",
  "auburnPolicy": "Which Auburn policy is violated",
  "farClause": "FAR clause reference if applicable",
  "suggestedAlternative": "Auburn-approved replacement text",
  "justification": "Why this change is needed",
  "confidence": 75-100
}

Be thorough and identify ALL compliance issues.`;

    const userPrompt = `Analyze this contract for Auburn University compliance:

CONTRACT TEXT:
${text.substring(0, 10000)}

Identify all compliance issues with Auburn policies and suggest alternatives.`;

    console.log('📨 [/api/contract-stream] Sending to OpenRouter:', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite'
    });

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('🌊 [/api/contract-stream] Starting stream...');
          
          // Send initial message
          controller.enqueue(new TextEncoder().encode('data: {"type":"start","message":"Initializing AI analysis..."}\n\n'));
          
          const response = await client.streamChat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ], {
            temperature: 0.2,
            maxTokens: 4000
          });

          console.log('📡 [/api/contract-stream] Got streaming response');
          
          let fullContent = '';
          let issuesFound: any[] = [];
          
          await client.processStream(response, (data) => {
            if (data.type === 'content') {
              fullContent += data.content;
              
              // Send progress update
              controller.enqueue(new TextEncoder().encode(
                `data: {"type":"progress","message":"Analyzing contract..."}\n\n`
              ));
              
              // Try to parse JSON if we have complete array
              if (fullContent.includes('[') && fullContent.includes(']')) {
                try {
                  const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
                  if (jsonMatch) {
                    const issues = JSON.parse(jsonMatch[0]);
                    console.log(`✅ [/api/contract-stream] Found ${issues.length} issues`);
                    
                    // Send each issue
                    for (const issue of issues) {
                      controller.enqueue(new TextEncoder().encode(
                        `data: ${JSON.stringify({
                          type: 'issue',
                          data: {
                            ...issue,
                            confidence: issue.confidence || 85
                          }
                        })}\n\n`
                      ));
                    }
                    issuesFound = issues;
                  }
                } catch (e) {
                  console.log('📝 [/api/contract-stream] Still collecting JSON...');
                }
              }
            } else if (data.type === 'done') {
              console.log('✅ [/api/contract-stream] Stream complete');
              
              // Send summary
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  summary: {
                    totalIssues: issuesFound.length,
                    highSeverity: issuesFound.filter((i: any) => i.severity === 'HIGH').length,
                    mediumSeverity: issuesFound.filter((i: any) => i.severity === 'MEDIUM').length,
                    lowSeverity: issuesFound.filter((i: any) => i.severity === 'LOW').length
                  }
                })}\n\n`
              ));
              
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              controller.close();
            }
          });
          
        } catch (error) {
          console.error('❌ [/api/contract-stream] Stream error:', error);
          controller.enqueue(new TextEncoder().encode(
            `data: {"type":"error","message":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('❌ [/api/contract-stream] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze contract',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Test endpoint
export async function GET() {
  console.log('🧪 [/api/contract-stream] Test endpoint called');
  
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
  
  console.log('🔑 [/api/contract-stream] Test config:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    apiKeyPrefix: apiKey?.substring(0, 20),
    model
  });
  
  return new Response(JSON.stringify({
    status: 'ready',
    hasApiKey: !!apiKey,
    model,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}