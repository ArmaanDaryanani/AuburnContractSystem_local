import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 =================== TEST OPENROUTER API ===================');
  
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
  
  console.log('🔑 Environment Check:');
  console.log('  - API Key exists:', !!apiKey);
  console.log('  - API Key length:', apiKey?.length);
  console.log('  - API Key prefix:', apiKey?.substring(0, 20) + '...');
  console.log('  - Model:', model);
  console.log('  - App URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  if (!apiKey) {
    console.error('❌ NO API KEY FOUND!');
    return NextResponse.json({ 
      error: 'No OpenRouter API key found',
      suggestion: 'Check your .env.local file'
    }, { status: 500 });
  }
  
  try {
    console.log('📡 Making test request to OpenRouter...');
    
    const requestBody = {
      model,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello from OpenRouter!" in exactly 5 words.'
        }
      ],
      temperature: 0.3,
      max_tokens: 50,
    };
    
    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Auburn Contract Review Test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return NextResponse.json({ 
        error: 'OpenRouter API error',
        status: response.status,
        details: data,
        model,
      }, { status: response.status });
    }
    
    const aiResponse = data.choices?.[0]?.message?.content || 'No response';
    console.log('✅ SUCCESS! AI Response:', aiResponse);
    console.log('🧪 =================== TEST COMPLETE ===================');
    
    return NextResponse.json({
      success: true,
      message: 'OpenRouter connection successful!',
      response: aiResponse,
      model,
      usage: data.usage,
    });
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      error: 'Failed to call OpenRouter',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}