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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    } catch (e) {
      // If not valid JSON, create structured response
      analysis = {
        violations: [],
        confidence: 0.85,
        summary: analysisContent
      };
    }
    
    // Merge compliance check violations with AI analysis violations
    const farViolations = complianceCheck.violations
      .filter(v => v.type === 'FAR_REQUIREMENT')
      .map((v, index) => ({
        id: `far-${index}`,
        type: v.term_type || 'FAR Violation',
        severity: v.severity,
        description: v.description,
        problematicText: v.description.match(/"([^"]+)"/)?.[1] || '',
        farReference: v.far_section || 'FAR Requirement',
        auburnPolicy: v.policy_reference || '',
        suggestion: v.suggested_alternative || 'Review FAR compliance requirements',
        confidence: v.confidence
      }));
    
    const auburnViolations = complianceCheck.violations
      .filter(v => v.type === 'AUBURN_POLICY')
      .map((v, index) => ({
        id: `auburn-${index}`,
        type: v.term_type || 'Auburn Policy',
        severity: v.severity,
        description: v.description,
        problematicText: v.description.match(/"([^"]+)"/)?.[1] || '',
        auburnPolicy: v.policy_reference || '',
        suggestion: v.suggested_alternative || 'Review Auburn policy requirements',
        confidence: v.confidence
      }));
    
    // Merge all violations
    analysis.violations = [
      ...(analysis.violations || []),
      ...farViolations,
      ...auburnViolations
    ];
    
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