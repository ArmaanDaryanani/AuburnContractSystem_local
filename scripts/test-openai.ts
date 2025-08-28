#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testOpenAIEmbedding() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.error('❌ No OpenAI API key found in .env.local');
    process.exit(1);
  }
  
  console.log('🔑 OpenAI API Key found');
  console.log('🧪 Testing OpenAI embeddings API...\n');
  
  const testText = "Auburn University cannot provide indemnification as a state entity";
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: testText,
        encoding_format: 'float'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', response.status);
      console.error('Error details:', error);
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log('✅ OpenAI API working!');
    console.log('📊 Embedding details:');
    console.log(`   - Model: ${data.model}`);
    console.log(`   - Dimensions: ${data.data[0].embedding.length}`);
    console.log(`   - Tokens used: ${data.usage.total_tokens}`);
    console.log(`   - First 5 values: [${data.data[0].embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    // Calculate cost
    const costPerMillion = 0.02; // $0.02 per million tokens
    const estimatedCost = (data.usage.total_tokens / 1000000) * costPerMillion;
    console.log(`   - Cost for this test: $${estimatedCost.toFixed(6)}`);
    
    // Estimate cost for all documents
    const avgTokensPerChunk = 250; // ~1000 chars = 250 tokens
    const totalChunks = 8348;
    const totalTokens = avgTokensPerChunk * totalChunks;
    const totalCost = (totalTokens / 1000000) * costPerMillion;
    
    console.log('\n💰 Cost Estimate for Full Regeneration:');
    console.log(`   - Total chunks: ${totalChunks}`);
    console.log(`   - Estimated tokens: ${totalTokens.toLocaleString()}`);
    console.log(`   - Estimated cost: $${totalCost.toFixed(2)}`);
    
    console.log('\n✨ Ready to regenerate all embeddings with OpenAI!');
    console.log('   Run: npm run regenerate-embeddings');
    
  } catch (error) {
    console.error('❌ Error testing OpenAI:', error);
    process.exit(1);
  }
}

testOpenAIEmbedding();