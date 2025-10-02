#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import after env vars are loaded
import { generateEmbedding } from '../src/lib/rag/document-ingestion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function regenerateEmbeddings() {
  console.log('🚀 Starting Embedding Regeneration with OpenAI\n');
  console.log('=' .repeat(60));
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ No OpenAI API key found in .env.local');
    process.exit(1);
  }
  
  console.log('🔑 OpenAI API Key found');
  console.log('📊 Using model: text-embedding-3-small\n');
  
  // Get all embeddings
  console.log('📥 Fetching existing embeddings...');
  const { data: embeddings, error: fetchError } = await supabase
    .from('document_embeddings')
    .select('id, chunk_text')
    .order('chunk_index', { ascending: true });
  
  if (fetchError) {
    console.error('❌ Error fetching embeddings:', fetchError);
    process.exit(1);
  }
  
  if (!embeddings || embeddings.length === 0) {
    console.log('⚠️  No embeddings found to regenerate');
    process.exit(0);
  }
  
  console.log(`📊 Found ${embeddings.length.toLocaleString()} embeddings to regenerate\n`);
  
  const BATCH_SIZE = 50;
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  
  console.log(`🔄 Processing in batches of ${BATCH_SIZE}...\n`);
  
  for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
    const batch = embeddings.slice(i, Math.min(i + BATCH_SIZE, embeddings.length));
    const progress = Math.round((i / embeddings.length) * 100);
    
    process.stdout.write(`\r📦 Progress: ${progress}% (${i}/${embeddings.length}) | ✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
    
    // Process batch
    for (const item of batch) {
      try {
        // Generate real OpenAI embedding
        const embedding = await generateEmbedding(item.chunk_text);
        
        // Update in database
        const { error: updateError } = await supabase
          .from('document_embeddings')
          .update({ embedding })
          .eq('id', item.id);
        
        if (updateError) {
          console.error(`\n⚠️  Error updating embedding ${item.id}:`, updateError.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`\n⚠️  Error generating embedding for ${item.id}:`, error);
        errorCount++;
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n\n' + '=' .repeat(60));
  console.log('\n✨ Embedding Regeneration Complete!\n');
  console.log('📊 Final Statistics:');
  console.log(`   ⏱️  Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`   ✅ Success: ${successCount.toLocaleString()} embeddings`);
  console.log(`   ❌ Errors: ${errorCount} embeddings`);
  console.log(`   💰 Estimated cost: ~$${(successCount * 250 / 1000000 * 0.02).toFixed(2)}`);
  
  if (errorCount === 0) {
    console.log('\n🎉 All embeddings successfully regenerated with OpenAI!');
    console.log('🔍 Your RAG system now has production-quality semantic search!');
  } else {
    console.log(`\n⚠️  ${errorCount} embeddings failed. You may want to run this again.`);
  }
  
  console.log('\n💡 Test semantic search with: npm run test-rag\n');
}

regenerateEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});