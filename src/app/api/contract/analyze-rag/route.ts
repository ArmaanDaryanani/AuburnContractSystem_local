import { NextRequest, NextResponse } from 'next/server';
import { 
  buildEnhancedCompliancePrompt,
  performComplianceCheck,
  searchFARRequirements,
  searchAuburnAlternatives 
} from '@/lib/rag/enhanced-rag-search';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { contractText, fileName } = await request.json();
    
    if (!contractText) {
      return NextResponse.json(
        { error: 'Contract text is required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Starting RAG-enhanced contract analysis...');
    
    // Save contract to database
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        title: fileName || 'Unnamed Contract',
        file_name: fileName,
        contract_text: contractText,
        status: 'analyzing'
      })
      .select()
      .single();
    
    if (contractError) {
      console.error('Error saving contract:', contractError);
    }
    
    // Perform compliance check first
    const complianceCheck = await performComplianceCheck(contractText, {
      checkFAR: true,
      checkAuburnPolicies: true,
      includeAlternatives: true,
      minConfidence: 0.65
    });
    
    console.log(`📊 Compliance check: ${complianceCheck.violations.length} violations, ${complianceCheck.alternatives.length} alternatives`);
    
    // Build enhanced prompt with FAR and Auburn context
    const enhancedPrompt = await buildEnhancedCompliancePrompt(contractText, {
      includeFAR: true,
      includeAlternatives: true,
      includeHistorical: false
    });
    
    console.log('📝 Enhanced prompt built with FAR and Auburn context');
    
    // Send to OpenRouter for analysis
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://auburn.edu',
        'X-Title': 'Auburn Contract Review',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst for Auburn University. 
                     Analyze contracts for compliance with Auburn policies and FAR requirements.
                     Always reference specific policies when identifying violations.
                     Provide structured JSON responses.`
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return NextResponse.json(
        { error: 'Failed to analyze contract' },
        { status: 500 }
      );
    }
    
    const result = await response.json();
    const analysisContent = result.choices[0].message.content;
    
    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
      console.log('🔍 AI Analysis Response:', JSON.stringify(analysis, null, 2).substring(0, 1000));
    } catch (e) {
      // If not valid JSON, create structured response
      analysis = {
        violations: [],
        confidence: 0.85,
        summary: analysisContent
      };
    }
    
    // Process AI-detected violations to ensure they have exact text
    if (analysis.violations) {
      console.log('📊 AI Violations Found:', analysis.violations.length);
      analysis.violations = analysis.violations.map((v: any, idx: number) => {
        console.log(`🎯 AI Violation ${idx}:`, {
          type: v.type,
          problematicText: v.problematicText?.substring(0, 100),
          hasMissingClause: v.problematicText === 'MISSING_CLAUSE'
        });
        return {
          ...v,
          id: `AI_${v.type}_${idx}`,
          // Use the problematicText field if provided by AI, otherwise keep existing
          clause: v.problematicText || v.clause || '',
          fullClause: v.fullClause || '',
          location: {
            exactText: v.problematicText || '',
            fullContext: v.fullClause || '',
            confidence: v.confidence || 0.7
          }
        };
      });
    }
    
    // Merge compliance check violations with AI analysis violations
    const farViolations = complianceCheck.violations
      .filter(v => v.type === 'FAR_REQUIREMENT')
      .map((v, index) => {
        // Check if this is about a missing clause by looking for keywords in the description
        const descLower = v.description?.toLowerCase() || '';
        const isMissingClause = descLower.includes('missing') || 
                                descLower.includes('not included') ||
                                descLower.includes('not present') ||
                                descLower.includes('absence') ||
                                descLower.includes('required but') ||
                                descLower.includes('does not include') ||
                                descLower.includes('does not contain') ||
                                descLower.includes('not found');
        
        console.log(`🔍 FAR violation check - ID: far-${index}, Missing: ${isMissingClause}, Desc: ${v.description?.substring(0, 100)}`);
        
        return {
          id: `far-${index}`,
          type: v.term_type || 'other',
          severity: v.severity,
          description: v.description,
          // For FAR violations, always mark as MISSING_CLAUSE since they're from the compliance matrix
          // The matrix checks for required clauses that should be present
          problematicText: 'MISSING_CLAUSE',
          clause: 'MISSING_CLAUSE',
          farReference: v.far_section || 'FAR Requirement',
          auburnPolicy: v.policy_reference || '',
          suggestion: v.suggested_alternative || 'Review FAR compliance requirements',
          confidence: v.confidence,
          location: {
            exactText: 'MISSING_CLAUSE',
            confidence: v.confidence || 0.7
          }
        };
      });
    
    const auburnViolations = complianceCheck.violations
      .filter(v => v.type === 'AUBURN_POLICY')
      .map((v, index) => {
        // Auburn policy violations from the compliance matrix are also about requirements
        console.log(`🔍 Auburn violation check - ID: auburn-${index}, Desc: ${v.description?.substring(0, 100)}`);
        
        return {
          id: `auburn-${index}`,
          type: v.term_type || 'other',
          severity: v.severity,
          description: v.description,
          // Auburn policy violations from the matrix are also about missing/required clauses
          problematicText: 'MISSING_CLAUSE',
          clause: 'MISSING_CLAUSE',
          auburnPolicy: v.policy_reference || '',
          suggestion: v.suggested_alternative || 'Review Auburn policy requirements',
          confidence: v.confidence,
          location: {
            exactText: 'MISSING_CLAUSE',
            confidence: v.confidence || 0.7
          }
        };
      });
    
    // Merge all violations - prioritize AI violations with actual text
    const allViolations = [
      ...(analysis.violations || []),  // AI violations come first (they have actual text)
      ...farViolations,                // FAR violations (missing clauses)
      ...auburnViolations               // Auburn violations (missing clauses)
    ];
    
    console.log('📋 Total violations before dedup:', allViolations.length, {
      ai: analysis.violations?.length || 0,
      far: farViolations.length,
      auburn: auburnViolations.length
    });
    
    // Deduplicate violations - keep violations with actual text over MISSING_CLAUSE
    const deduplicatedViolations: any[] = [];
    const seenTopics = new Map<string, any>(); // Track by topic/FAR reference
    
    for (const violation of allViolations) {
      // Create a key based on FAR reference or violation type
      const topicKey = violation.farReference || violation.type || 'unknown';
      
      // Check if we've seen this topic before
      const existing = seenTopics.get(topicKey);
      
      if (!existing) {
        // First time seeing this topic, add it
        deduplicatedViolations.push(violation);
        seenTopics.set(topicKey, violation);
      } else if (existing.problematicText === 'MISSING_CLAUSE' && violation.problematicText !== 'MISSING_CLAUSE') {
        // Replace MISSING_CLAUSE with actual text
        const index = deduplicatedViolations.indexOf(existing);
        if (index !== -1) {
          deduplicatedViolations[index] = violation;
          seenTopics.set(topicKey, violation);
        }
      }
    }
    
    console.log('📋 Total violations after dedup:', deduplicatedViolations.length);
    
    analysis.violations = deduplicatedViolations;
    
    // Add compliance summary
    if (complianceCheck.violations.length > 0 || complianceCheck.alternatives.length > 0) {
      analysis.complianceResults = {
        overallRisk: complianceCheck.overall_risk,
        complianceScore: complianceCheck.compliance_score,
        totalFARViolations: farViolations.length,
        totalAuburnViolations: auburnViolations.length,
        suggestedAlternatives: complianceCheck.alternatives
      };
    }
    
    // Save analysis results to database
    if (contract) {
      const { error: analysisError } = await supabase
        .from('contract_analyses')
        .insert({
          contract_id: contract.id,
          analysis_type: 'ai_rag',
          confidence_score: analysis.confidence || 0.85,
          total_violations: analysis.violations?.length || 0,
          critical_violations: analysis.violations?.filter((v: any) => v.severity === 'CRITICAL').length || 0,
          violations: analysis.violations || [],
          alternatives: analysis.alternatives || [],
          ai_model_used: process.env.OPENROUTER_MODEL,
          compliance_status: analysis.violations?.length > 0 ? 'violations_found' : 'compliant'
        });
      
      if (analysisError) {
        console.error('Error saving analysis:', analysisError);
      }
      
      // Update contract status
      await supabase
        .from('contracts')
        .update({ status: 'analyzed' })
        .eq('id', contract.id);
    }
    
    console.log('✅ RAG-enhanced analysis complete');
    
    // Add RAG indicator to response
    analysis.ragEnhanced = true;
    analysis.contextSources = ['FAR Matrix', 'Auburn Policies', 'Contract Terms Matrix'];
    analysis.farRequirements = complianceCheck.far_requirements.slice(0, 5);
    analysis.totalContextUsed = complianceCheck.far_requirements.length + complianceCheck.alternatives.length;
    
    return NextResponse.json(analysis);
    
  } catch (error) {
    console.error('Error in RAG contract analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze contract with RAG' },
      { status: 500 }
    );
  }
}