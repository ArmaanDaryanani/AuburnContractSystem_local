#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import after env vars are loaded
import { generateEmbedding } from '../src/lib/rag/document-ingestion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function regenerateAllEmbeddings() {
  console.log('🚀 Starting Complete Embedding Regeneration with OpenAI\n');
  console.log('=' .repeat(60));
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ No OpenAI API key found in .env.local');
    process.exit(1);
  }
  
  console.log('🔑 OpenAI API Key found');
  console.log('📊 Using model: text-embedding-3-small\n');
  
  // Get total count first
  const { count: totalCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total embeddings to regenerate: ${totalCount?.toLocaleString()}\n`);
  
  const BATCH_SIZE = 50;
  const PAGE_SIZE = 1000;
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();
  
  console.log(`🔄 Processing in pages of ${PAGE_SIZE}, batches of ${BATCH_SIZE}...\n`);
  
  // Process in pages to handle large datasets
  let offset = 0;
  
  while (offset < (totalCount || 0)) {
    // Get page of embeddings
    const { data: embeddings, error: fetchError } = await supabase
      .from('document_embeddings')
      .select('id, chunk_text')
      .order('chunk_index', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    
    if (fetchError) {
      console.error('❌ Error fetching embeddings:', fetchError);
      break;
    }
    
    if (!embeddings || embeddings.length === 0) break;
    
    console.log(`\n📄 Processing page ${Math.floor(offset / PAGE_SIZE) + 1} (${offset + 1}-${Math.min(offset + PAGE_SIZE, totalCount || 0)} of ${totalCount})`);
    
    // Process this page in batches
    for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
      const batch = embeddings.slice(i, Math.min(i + BATCH_SIZE, embeddings.length));
      const globalProgress = Math.round(((offset + i) / (totalCount || 1)) * 100);
      
      process.stdout.write(`\r📦 Overall: ${globalProgress}% | Page: ${i}/${embeddings.length} | ✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
      
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
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    offset += PAGE_SIZE;
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n\n' + '=' .repeat(60));
  console.log('\n✨ Complete Embedding Regeneration Finished!\n');
  console.log('📊 Final Statistics:');
  console.log(`   ⏱️  Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`   ✅ Success: ${successCount.toLocaleString()} embeddings`);
  console.log(`   ❌ Errors: ${errorCount} embeddings`);
  console.log(`   💰 Actual cost: ~$${(successCount * 250 / 1000000 * 0.02).toFixed(2)}`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 ALL embeddings successfully regenerated with OpenAI!');
    console.log('🔍 Your RAG system now has production-quality semantic search!');
  } else if (successCount > 0) {
    console.log(`\n✅ Successfully regenerated ${successCount}/${totalCount} embeddings`);
  }
  
  console.log('\n💡 Test semantic search with: npm run test-rag\n');
}

regenerateAllEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});