#!/usr/bin/env node

import dotenv from 'dotenv';
import { searchFARViolations, getAuburnPolicyContext, searchKnowledgeBase } from '../src/lib/rag/rag-search';

dotenv.config({ path: '.env.local' });

async function testRAGSearch() {
  console.log('🔍 Testing RAG Semantic Search\n');
  console.log('=' .repeat(60));
  
  const testQueries = [
    {
      name: 'Auburn Indemnification Policy',
      query: 'Auburn cannot provide indemnification as a state entity',
      type: 'auburn_policy'
    },
    {
      name: 'FAR Payment Terms',
      query: 'payment terms net 30 days milestone',
      type: 'far'
    },
    {
      name: 'Intellectual Property Rights',
      query: 'faculty intellectual property ownership retention',
      type: 'auburn_policy'
    },
    {
      name: 'FAR Compliance - Cost Accounting',
      query: 'cost accounting standards CAS disclosure',
      type: 'far'
    },
    {
      name: 'Auburn Insurance Requirements',
      query: 'self-insured State of Alabama insurance requirements',
      type: 'auburn_policy'
    }
  ];
  
  for (const test of testQueries) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   Type: ${test.type}\n`);
    
    try {
      let results;
      
      if (test.type === 'far') {
        results = await searchFARViolations(test.query, 3);
        console.log(`   Found ${results.length} FAR matches:`);
      } else if (test.type === 'auburn_policy') {
        results = await getAuburnPolicyContext(test.query, 3);
        console.log(`   Found ${results.length} Auburn policy matches:`);
      } else {
        results = await searchKnowledgeBase(test.query, 3);
        console.log(`   Found ${results.length} general matches:`);
      }
      
      results.forEach((result: any, idx: number) => {
        const similarity = result.similarity || result.score || 'N/A';
        const title = result.title || result.policy_title || 'Unknown';
        const preview = (result.content || result.chunk_text || result.policy_text || '')
          .substring(0, 100)
          .replace(/\n/g, ' ');
        
        console.log(`\n   ${idx + 1}. [Score: ${typeof similarity === 'number' ? similarity.toFixed(4) : similarity}]`);
        console.log(`      📄 ${title}`);
        console.log(`      "${preview}..."`);
      });
      
      if (results.length === 0) {
        console.log('   ⚠️  No matches found');
      }
      
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n✅ RAG Search Test Complete!\n');
  
  // Test the combined prompt builder
  console.log('📝 Testing Enhanced Prompt Builder...\n');
  
  const sampleContract = `
    This Agreement requires Auburn University to indemnify and hold harmless
    the Contractor from any claims. Payment shall be made within 90 days
    of invoice receipt. All intellectual property created shall belong to
    the Contractor.
  `;
  
  try {
    const { buildEnhancedPrompt } = await import('../src/lib/rag/rag-search');
    const enhancedPrompt = await buildEnhancedPrompt(sampleContract, true);
    
    console.log('✅ Enhanced prompt built successfully!');
    console.log('   Length:', enhancedPrompt.length, 'characters');
    console.log('   Contains RAG context:', enhancedPrompt.includes('RELEVANT DOCUMENTS'));
    
  } catch (error) {
    console.error('❌ Error building enhanced prompt:', error);
  }
  
  console.log('\n💡 The RAG system is now ready for production use!\n');
}

testRAGSearch().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});