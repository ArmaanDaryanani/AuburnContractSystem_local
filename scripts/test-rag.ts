#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import after env vars are loaded
import { 
  searchSimilarDocuments, 
  getAuburnPolicyContext,
  buildEnhancedPrompt 
} from '../src/lib/rag/rag-search';

const testQueries = [
  "Auburn agrees to indemnify and hold harmless the vendor",
  "Payment due within 15 days",
  "This agreement shall automatically renew",
  "Vendor shall maintain commercial insurance",
  "Disputes shall be resolved in California courts"
];

async function testRAGSearch() {
  console.log('🧪 Testing RAG Search System\n');
  console.log('================================\n');
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(50));
    
    // Test similarity search
    console.log('\n🔍 Similar Documents:');
    const similar = await searchSimilarDocuments(query, 3);
    if (similar.length > 0) {
      similar.forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc.document_title} (${doc.document_type})`);
        console.log(`     Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
        console.log(`     Preview: ${doc.chunk_text.substring(0, 100)}...`);
      });
    } else {
      console.log('  No similar documents found');
    }
    
    // Test policy context
    console.log('\n📋 Auburn Policy Context:');
    const context = await getAuburnPolicyContext(query, 2);
    if (context.length > 0) {
      context.forEach((policy, i) => {
        console.log(`  ${i + 1}. ${policy.policy_title}`);
        console.log(`     Relevance: ${(policy.similarity * 100).toFixed(1)}%`);
        console.log(`     Policy: ${policy.policy_text.substring(0, 150)}...`);
      });
    } else {
      console.log('  No policy context found');
    }
  }
  
  // Test enhanced prompt building
  console.log('\n\n🎯 Testing Enhanced Prompt Building\n');
  console.log('================================\n');
  
  const sampleContract = `
    This Service Agreement is between Auburn University and Vendor Corp.
    
    1. INDEMNIFICATION: Auburn University agrees to indemnify, defend, and hold harmless 
       Vendor from any claims arising from Auburn's use of the services.
    
    2. PAYMENT: Payment is due within 15 days of invoice receipt.
    
    3. RENEWAL: This agreement shall automatically renew for successive one-year terms 
       unless either party provides 30 days written notice.
    
    4. GOVERNING LAW: This agreement shall be governed by California law and any disputes 
       shall be resolved in California courts.
  `;
  
  const enhancedPrompt = await buildEnhancedPrompt(sampleContract);
  console.log('Enhanced Prompt Preview:');
  console.log(enhancedPrompt.substring(0, 1000));
  console.log('\n... [truncated for display]');
  
  console.log('\n\n✅ RAG System Test Complete!\n');
  console.log('If you see relevant policies and context above, your RAG system is working correctly.');
  console.log('If results are empty, make sure you have:');
  console.log('  1. Run the database migrations');
  console.log('  2. Seeded the knowledge base');
  console.log('  3. Generated embeddings');
}

testRAGSearch().catch(console.error);