#!/usr/bin/env tsx

/**
 * Test script to verify contract analysis with enhanced RAG
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const API_URL = 'http://localhost:3000/api/contract/analyze-rag';

// Sample contract text with potential FAR violations
const testContract = `
PROFESSIONAL SERVICES AGREEMENT

This Agreement is entered into between Auburn University ("University") and Contractor ("Vendor").

1. TERMINATION
Either party may terminate this agreement at any time without cause and without penalty by providing written notice to the other party. Upon termination, all work product, data, and materials shall immediately become the exclusive property of the Contractor.

2. INDEMNIFICATION
The University shall indemnify, defend, and hold harmless the Contractor from any and all claims, damages, losses, and expenses, including attorney's fees, arising out of or resulting from the performance of services under this Agreement.

3. CONFIDENTIALITY
All information shared between the parties shall be considered confidential. The Contractor may share University information with third parties as deemed necessary for business purposes without prior written consent.

4. LIMITATION OF LIABILITY
Under no circumstances shall the Contractor be liable for any indirect, incidental, special, or consequential damages, regardless of the form of action or the basis of the claim, even if advised of the possibility of such damages.

5. AUDIT RIGHTS
The University waives all rights to audit the Contractor's records, books, and documentation related to this Agreement.

6. COMPLIANCE
The Contractor shall make reasonable efforts to comply with applicable federal regulations, including Federal Acquisition Regulations (FAR), where convenient.

7. INTELLECTUAL PROPERTY
All intellectual property created under this Agreement shall be the sole property of the Contractor, including any derivatives or improvements to existing University intellectual property.

8. PAYMENT TERMS
Payment shall be made within 90 days of invoice receipt. Late payments will incur a 5% monthly interest charge.
`;

async function testContractAnalysis() {
  console.log('🔍 Testing Contract Analysis with Enhanced RAG');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // Create a session cookie for testing
    const sessionData = {
      authenticated: true,
      username: 'test-user',
      timestamp: Date.now()
    };
    const sessionCookie = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    console.log('📄 Sending contract for analysis...\n');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auburn-cr-session=${sessionCookie}`
      },
      body: JSON.stringify({
        contractText: testContract,
        fileName: 'test-contract.txt'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const analysis = await response.json();
    
    console.log('✅ Analysis Complete!\n');
    console.log('═══════════════════════════════════════════');
    
    // Display basic results
    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('───────────────────');
    console.log(`RAG Enhanced: ${analysis.ragEnhanced ? '✅ Yes' : '❌ No'}`);
    console.log(`Context Sources: ${analysis.contextSources?.join(', ') || 'None'}`);
    console.log(`Total Context Used: ${analysis.totalContextUsed || 0} items`);
    
    // Display compliance results if available
    if (analysis.complianceResults) {
      console.log('\n⚖️ COMPLIANCE CHECK:');
      console.log('──────────────────');
      console.log(`Overall Risk: ${analysis.complianceResults.overallRisk || 'Unknown'}`);
      console.log(`Compliance Score: ${analysis.complianceResults.complianceScore || 0}/100`);
      console.log(`FAR Violations: ${analysis.complianceResults.farViolations?.length || 0}`);
      console.log(`Auburn Policy Violations: ${analysis.complianceResults.auburnPolicyViolations?.length || 0}`);
      console.log(`Suggested Alternatives: ${analysis.complianceResults.suggestedAlternatives?.length || 0}`);
    }
    
    // Display violations
    if (analysis.violations && analysis.violations.length > 0) {
      console.log('\n⚠️ VIOLATIONS FOUND:');
      console.log('─────────────────');
      analysis.violations.slice(0, 5).forEach((violation: any, index: number) => {
        console.log(`\n${index + 1}. ${violation.type || 'General Violation'}`);
        console.log(`   Severity: ${violation.severity || 'Medium'}`);
        console.log(`   Description: ${violation.description?.substring(0, 100)}...`);
        if (violation.suggestion) {
          console.log(`   Suggestion: ${violation.suggestion.substring(0, 100)}...`);
        }
      });
    }
    
    // Display FAR requirements if available
    if (analysis.farRequirements && analysis.farRequirements.length > 0) {
      console.log('\n📋 RELEVANT FAR REQUIREMENTS:');
      console.log('──────────────────────────');
      analysis.farRequirements.forEach((req: any, index: number) => {
        console.log(`\n${index + 1}. FAR ${req.far_section || 'N/A'}`);
        console.log(`   Risk Level: ${req.risk_level || 'Standard'}`);
        console.log(`   Similarity: ${((req.similarity || 0) * 100).toFixed(1)}%`);
      });
    }
    
    // Display alternatives if available
    if (analysis.complianceResults?.suggestedAlternatives?.length > 0) {
      console.log('\n💡 SUGGESTED ALTERNATIVES:');
      console.log('────────────────────────');
      analysis.complianceResults.suggestedAlternatives.slice(0, 3).forEach((alt: any, index: number) => {
        console.log(`\n${index + 1}. ${alt.term_type || 'General'}`);
        if (alt.alternative_language) {
          console.log(`   Alternative: ${alt.alternative_language.substring(0, 150)}...`);
        }
        console.log(`   Auburn Approved: ${alt.is_auburn_approved ? '✅' : '❌'}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ Contract analysis test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error testing contract analysis:', error);
    console.log('\nMake sure the development server is running (npm run dev)');
  }
}

// Run the test
testContractAnalysis();