#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkStats() {
  const { count: totalCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n📊 Embedding Statistics:');
  console.log('   Total embeddings:', totalCount?.toLocaleString());
  
  // Check by document
  const { data: docs } = await supabase
    .from('knowledge_documents')
    .select('id, title, document_type');
  
  if (docs) {
    console.log('\n📚 By Document:');
    for (const doc of docs) {
      const { count } = await supabase
        .from('document_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc.id);
      
      console.log(`   - ${doc.title}: ${count?.toLocaleString()} chunks`);
    }
  }
  
  // Sample a recent embedding to check if it's OpenAI or mock
  const { data: sample } = await supabase
    .from('document_embeddings')
    .select('id, chunk_text, embedding')
    .order('chunk_index', { ascending: false })
    .limit(1)
    .single();
  
  if (sample && sample.embedding) {
    // Check first few values - OpenAI embeddings have more varied values
    const firstValues = sample.embedding.slice(0, 5);
    console.log('\n🔍 Sample Embedding Analysis:');
    console.log('   First 5 values:', firstValues.map((v: number) => v.toFixed(4)));
    
    // Mock embeddings have a pattern, OpenAI are more random
    const variance = Math.sqrt(firstValues.reduce((sum: number, val: number) => {
      const mean = firstValues.reduce((a: number, b: number) => a + b) / firstValues.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / firstValues.length);
    
    console.log('   Variance:', variance.toFixed(4));
    console.log('   Type:', variance > 0.01 ? '✅ OpenAI embeddings' : '⚠️  Mock embeddings');
  }
}

checkStats().catch(console.error);