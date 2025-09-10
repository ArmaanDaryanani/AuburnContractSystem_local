#!/usr/bin/env tsx

/**
 * Test script for enhanced RAG system with FAR Matrix and Contract Terms
 */

import { 
  searchFARRequirements,
  searchAuburnAlternatives,
  performComplianceCheck,
  getContractRecommendations,
  searchSpecificFARViolations
} from '../src/lib/rag/enhanced-rag-search';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Test contract clauses
const testClauses = {
  indemnification: `The Contractor shall indemnify and hold harmless the University from any and all claims, 
    damages, losses, and expenses arising out of the Contractor's performance under this agreement.`,
  
  termination: `This agreement may be terminated by either party with 30 days written notice. 
    Upon termination, all work product shall become the property of the University.`,
  
  confidentiality: `The Contractor agrees to maintain the confidentiality of all proprietary information 
    received from the University and shall not disclose such information to third parties without prior written consent.`,
  
  liability: `In no event shall either party be liable for indirect, incidental, special, or consequential damages, 
    regardless of the form of action or the basis of the claim.`,
  
  farRelated: `The contractor shall comply with all applicable Federal Acquisition Regulation requirements 
    and maintain proper documentation for audit purposes.`
};

async function testFARSearch() {
  console.log('\n🔍 Testing FAR Requirements Search');
  console.log('═══════════════════════════════════════\n');
  
  const results = await searchFARRequirements(testClauses.farRelated, undefined, 5);
  
  console.log(`Found ${results.length} relevant FAR requirements:\n`);
  results.forEach((req, index) => {
    console.log(`${index + 1}. FAR ${req.far_section}`);
    console.log(`   Requirement: ${req.requirement_text.substring(0, 150)}...`);
    console.log(`   Risk Level: ${req.risk_level}`);
    console.log(`   Similarity: ${(req.similarity * 100).toFixed(1)}%`);
    console.log(`   Auburn Policy: ${req.auburn_policy || 'None specified'}\n`);
  });
}

async function testAlternativeSearch() {
  console.log('\n📝 Testing Auburn Alternative Language Search');
  console.log('═══════════════════════════════════════\n');
  
  const alternatives = await searchAuburnAlternatives(testClauses.indemnification, 'Indemnification', 3);
  
  console.log(`Found ${alternatives.length} Auburn-approved alternatives:\n`);
  alternatives.forEach((alt, index) => {
    console.log(`${index + 1}. Term Type: ${alt.term_type}`);
    if (alt.alternative_language) {
      console.log(`   Alternative: ${alt.alternative_language.substring(0, 200)}...`);
    }
    console.log(`   Risk Level: ${alt.risk_level}`);
    console.log(`   Similarity: ${(alt.similarity * 100).toFixed(1)}%`);
    console.log(`   Auburn Approved: ${alt.is_auburn_approved ? '✅' : '❌'}\n`);
  });
}

async function testComplianceCheck() {
  console.log('\n⚖️ Testing Comprehensive Compliance Check');
  console.log('═══════════════════════════════════════\n');
  
  const fullContract = Object.values(testClauses).join('\n\n');
  const result = await performComplianceCheck(fullContract, {
    checkFAR: true,
    checkAuburnPolicies: true,
    includeAlternatives: true,
    minConfidence: 0.7
  });
  
  console.log('Compliance Check Results:');
  console.log(`Overall Risk: ${result.overall_risk}`);
  console.log(`Compliance Score: ${result.compliance_score}/100`);
  console.log(`Violations Found: ${result.violations.length}`);
  console.log(`Alternatives Suggested: ${result.alternatives.length}\n`);
  
  if (result.violations.length > 0) {
    console.log('Top Violations:');
    result.violations.slice(0, 3).forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.type}`);
      console.log(`   Description: ${violation.description.substring(0, 150)}...`);
      console.log(`   Severity: ${violation.severity}`);
      console.log(`   Confidence: ${(violation.confidence * 100).toFixed(1)}%`);
      if (violation.far_section) {
        console.log(`   FAR Section: ${violation.far_section}`);
      }
      if (violation.suggested_alternative) {
        console.log(`   Suggested Alternative: ${violation.suggested_alternative.substring(0, 100)}...`);
      }
    });
  }
}

async function testRecommendations() {
  console.log('\n💡 Testing Contract Recommendations');
  console.log('═══════════════════════════════════════\n');
  
  const termTypes = ['Termination', 'Liability', 'Confidentiality'];
  
  for (const termType of termTypes) {
    console.log(`\nRecommendations for ${termType} clause:`);
    const recommendations = await getContractRecommendations(
      termType, 
      testClauses[termType.toLowerCase() as keyof typeof testClauses] || ''
    );
    
    console.log(`Risk Assessment: ${recommendations.riskAssessment}`);
    console.log(`Compliance Notes: ${recommendations.complianceNotes}`);
    
    if (recommendations.recommended) {
      console.log(`Recommended Language: ${recommendations.recommended.substring(0, 150)}...`);
    }
    
    if (recommendations.alternatives.length > 0) {
      console.log(`Alternative Options: ${recommendations.alternatives.length} found`);
    }
  }
}

async function testSpecificFARSections() {
  console.log('\n🎯 Testing Specific FAR Section Violations');
  console.log('═══════════════════════════════════════\n');
  
  const farSections = ['52.203', '52.204', '52.227']; // Common FAR sections
  const violations = await searchSpecificFARViolations(testClauses.farRelated, farSections);
  
  console.log('FAR Section Violation Check:');
  violations.forEach(violation => {
    const status = violation.violated ? '⚠️ POTENTIAL VIOLATION' : '✅ COMPLIANT';
    console.log(`\nFAR ${violation.farSection}: ${status}`);
    console.log(`Confidence: ${(violation.confidence * 100).toFixed(1)}%`);
    console.log(`Details: ${violation.details.substring(0, 100)}...`);
  });
}

async function testQueryPerformance() {
  console.log('\n⚡ Testing Query Performance');
  console.log('═══════════════════════════════════════\n');
  
  const iterations = 5;
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await searchFARRequirements(testClauses.farRelated, undefined, 5);
    const end = Date.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`Average query time: ${avgTime.toFixed(0)}ms`);
  console.log(`Min time: ${minTime}ms`);
  console.log(`Max time: ${maxTime}ms`);
  console.log(`Queries per second: ${(1000 / avgTime).toFixed(1)}`);
}

async function main() {
  console.log('🚀 Starting Enhanced RAG System Tests');
  console.log('=====================================');
  
  try {
    await testFARSearch();
    await testAlternativeSearch();
    await testComplianceCheck();
    await testRecommendations();
    await testSpecificFARSections();
    await testQueryPerformance();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('=====================================\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
main();