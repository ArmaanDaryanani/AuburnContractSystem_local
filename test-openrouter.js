// Simple test script to verify OpenRouter API connectivity
// Run with: node test-openrouter.js

const API_KEY = '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';
const MODEL = 'google/gemini-2.5-flash-lite';

async function testOpenRouter() {
  console.log('🧪 Testing OpenRouter API...');
  console.log('📍 Model:', MODEL);
  console.log('🔑 API Key:', API_KEY.substring(0, 20) + '...');
  console.log('');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3004',
        'X-Title': 'Auburn Contract Review Test'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from Auburn Contract Review!" and nothing else.'
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }

    console.log('✅ Success! Response:', data.choices?.[0]?.message?.content);
    console.log('');
    console.log('📊 Usage:', data.usage);
    console.log('🏷️ Model used:', data.model);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOpenRouter();