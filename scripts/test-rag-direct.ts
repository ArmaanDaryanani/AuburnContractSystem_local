#!/usr/bin/env tsx

/**
 * Direct test of RAG search functions
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000),
  });
  return response.data[0].embedding;
}

async function testDirectSearch() {
  console.log('🔍 Testing Direct RAG Search\n');
  
  // Test search query
  const testQuery = "The contractor shall provide monthly reports and invoices within 30 days";
  
  console.log('📝 Test Query:', testQuery);
  console.log('Generating embedding...');
  
  const embedding = await generateEmbedding(testQuery);
  console.log('✅ Embedding generated, dimensions:', embedding.length);
  
  // Test 1: Search FAR requirements
  console.log('\n1️⃣ Testing search_far_requirements RPC...');
  const { data: farData, error: farError } = await supabase.rpc('search_far_requirements', {
    query_embedding: embedding,
    match_count: 5
  });
  
  if (farError) {
    console.error('❌ FAR search error:', farError);
  } else {
    console.log(`✅ Found ${farData?.length || 0} FAR matches`);
    if (farData && farData.length > 0) {
      console.log('Top FAR match:', {
        far_section: farData[0].far_section,
        risk_level: farData[0].risk_level,
        similarity: farData[0].similarity
      });
    }
  }
  
  // Test 2: Search Auburn alternatives
  console.log('\n2️⃣ Testing search_auburn_alternatives RPC...');
  const { data: auburnData, error: auburnError } = await supabase.rpc('search_auburn_alternatives', {
    query_embedding: embedding,
    match_count: 5
  });
  
  if (auburnError) {
    console.error('❌ Auburn search error:', auburnError);
  } else {
    console.log(`✅ Found ${auburnData?.length || 0} Auburn alternatives`);
    if (auburnData && auburnData.length > 0) {
      console.log('Top Auburn match:', {
        term_type: auburnData[0].term_type,
        is_auburn_approved: auburnData[0].is_auburn_approved,
        similarity: auburnData[0].similarity
      });
    }
  }
  
  // Test 3: Direct query to document_embeddings
  console.log('\n3️⃣ Testing direct document_embeddings query...');
  const { data: directData, error: directError } = await supabase
    .from('document_embeddings')
    .select('id, far_section, term_type, risk_level, chunk_text')
    .or('far_section.not.is.null,term_type.not.is.null')
    .limit(5);
    
  if (directError) {
    console.error('❌ Direct query error:', directError);
  } else {
    console.log(`✅ Found ${directData?.length || 0} documents`);
    if (directData && directData.length > 0) {
      console.log('Sample documents:');
      directData.forEach(doc => {
        console.log(`  - ${doc.far_section || doc.term_type}: ${doc.chunk_text.substring(0, 100)}...`);
      });
    }
  }
  
  // Test 4: Check total counts
  console.log('\n4️⃣ Checking total document counts...');
  const { count: farCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true })
    .not('far_section', 'is', null);
    
  const { count: termCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true })
    .not('term_type', 'is', null);
    
  console.log(`📊 Total FAR clauses: ${farCount}`);
  console.log(`📊 Total Contract Terms: ${termCount}`);
}

// Run the test
testDirectSearch().catch(console.error);