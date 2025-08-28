import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function POST(request: NextRequest) {
  try {
    const { contractText, model = 'google/gemini-2.0-flash-lite' } = await request.json();

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // System prompt for contract analysis
          const systemPrompt = `You are an expert contract analyst for Auburn University, specializing in:
- Federal Acquisition Regulation (FAR) compliance
- Auburn University contracting policies
- Risk assessment and mitigation
- Alternative language suggestions

Analyze contracts for:
1. FAR violations (52.245-1, 28.106, 27.402, 32.906, 28.103)
2. Auburn policy violations (indemnification, IP rights, payment terms, liability)
3. Missing required clauses
4. Ambiguous language requiring clarification
5. High-risk provisions`;

          const userPrompt = `Analyze this contract for Auburn University compliance issues:

${contractText}

Provide:
1. List of specific violations with FAR references
2. Risk assessment for each violation
3. Suggested alternative language
4. Overall compliance score
5. Executive summary of key issues`;

          // Call OpenRouter streaming API
          const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              'X-Title': 'Auburn Contract Review System',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.3,
              max_tokens: 2000,
              stream: true,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    const chunk = encoder.encode(
                      `data: ${JSON.stringify({ text: content })}\n\n`
                    );
                    controller.enqueue(chunk);
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          const errorChunk = encoder.encode(
            `data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`
          );
          controller.enqueue(errorChunk);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Contract analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze contract' },
      { status: 500 }
    );
  }
}