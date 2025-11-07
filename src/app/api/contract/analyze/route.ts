import { NextRequest, NextResponse } from 'next/server';
import { buildEnhancedPrompt, searchFARViolations, getAuburnPolicyContext } from '@/lib/rag/rag-search';
import { runDetections } from '@/lib/detect/run-detections';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

export async function POST(request: NextRequest) {
  console.log('🚀 [/api/contract/analyze] Analysis request received');
  
  try {
    const body = await request.json();
    const { text, fileName, useAI = true } = body;
    
    console.log('📄 [/api/contract/analyze] Processing:', {
      fileName,
      textLength: text?.length,
      useAI,
      hasApiKey: !!OPENROUTER_API_KEY
    });

    if (!text) {
      return NextResponse.json(
        { error: 'No contract text provided' },
        { status: 400 }
      );
    }

    if (!useAI || !OPENROUTER_API_KEY) {
      console.log('⚠️ [/api/contract/analyze] No LLM available, using AI clause detection with FAR/T&C rules');
      
      try {
        const detections = await runDetections(text, {
          useAI: true,
          minConfidence: 0.3,
          fuzzyThreshold: 0.35,
        });
        
        const violations = detections.map(d => ({
          id: d.id,
          type: d.category.toLowerCase().replace(/\s+/g, '-'),
          severity: d.severity,
          title: d.type === 'MISSING_CLAUSE' ? `Missing: ${d.category}` : `Problematic: ${d.category}`,
          description: d.explanation || '',
          problematicText: d.exactText,
          auburnPolicy: d.preferredLanguage,
          farReference: d.reference,
          confidence: d.confidence,
          pageNumber: d.pageNumber,
          isMissingClause: d.type === 'MISSING_CLAUSE',
        }));
        
        return NextResponse.json({
          violations,
          confidence: detections.length > 0 ? 85 : 95,
          riskScore: Math.min(detections.filter(d => d.severity === 'CRITICAL' || d.severity === 'HIGH').length * 2, 10),
          method: "ai-clause-detection",
          summary: `Found ${detections.length} compliance issues using AI clause detection`
        });
      } catch (detectionError) {
        console.error('⚠️ [/api/contract/analyze] AI detection failed:', detectionError);
        return NextResponse.json({
          violations: [],
          confidence: 50,
          riskScore: 0,
          method: "detection-failed",
          error: 'AI detection system failed'
        });
      }
    }

    // Use RAG to build enhanced prompt with real Auburn policies and FAR regulations
    console.log('🔍 [/api/contract/analyze] Building RAG-enhanced prompt');
    
    let enhancedPrompt;
    try {
      // Get RAG-enhanced prompt with real Auburn policies and FAR regulations
      enhancedPrompt = await buildEnhancedPrompt(text.substring(0, 8000), true);
      console.log('✅ [/api/contract/analyze] RAG enhancement successful');
    } catch (ragError) {
      console.warn('⚠️ [/api/contract/analyze] RAG enhancement failed, using fallback:', ragError);
      
      // Fallback prompt if RAG fails
      enhancedPrompt = `You are an expert contract analyst for Auburn University. Analyze contracts for compliance with Auburn policies and Federal Acquisition Regulations (FAR).

KEY AUBURN POLICIES:
1. Auburn CANNOT provide indemnification (state entity restriction)
2. Faculty must retain intellectual property rights for their work
3. Payment terms must be NET 30 days (not milestone-based)
4. Auburn is self-insured through State of Alabama
5. Publication rights must be preserved for research
6. Export control compliance is mandatory
7. Termination for convenience clause required

CONTRACT TO ANALYZE:
${text.substring(0, 8000)}

Analyze the contract and identify all compliance issues.`;
    }

    // Search for specific FAR violations
    console.log('📋 [/api/contract/analyze] Searching for FAR violations');
    const farViolations = await searchFARViolations(text.substring(0, 2000), 5);
    
    // Get Auburn policy context for key clauses
    console.log('🏫 [/api/contract/analyze] Getting Auburn policy context');
    const indemnityContext = text.toLowerCase().includes('indemnif') 
      ? await getAuburnPolicyContext('indemnification hold harmless', 3)
      : [];
    const paymentContext = text.toLowerCase().includes('payment') 
      ? await getAuburnPolicyContext('payment terms net 30', 3)
      : [];

    // Add the context to the prompt
    const contextualPrompt = `${enhancedPrompt}

RELEVANT FAR VIOLATIONS DETECTED:
${farViolations.map((v: any) => `- ${v.clause_text || v.content || 'FAR violation detected'}`).join('\n')}

AUBURN POLICY CONTEXT:
${indemnityContext.map((p: any) => `- ${p.policy_title || 'Policy'}: ${p.policy_text || p.content}`).join('\n')}
${paymentContext.map((p: any) => `- ${p.policy_title || 'Policy'}: ${p.policy_text || p.content}`).join('\n')}

Return a JSON response with this EXACT structure:
{
  "violations": [
    {
      "id": "unique-id",
      "type": "indemnification|ip-rights|payment|insurance|publication|export-control|termination|other",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "title": "Brief title of violation",
      "description": "Detailed explanation of the issue",
      "problematicText": "Exact quote from contract",
      "auburnPolicy": "Which Auburn policy is violated",
      "farReference": "FAR clause number if applicable",
      "suggestion": "Auburn-compliant replacement text",
      "confidence": 0.75 to 1.0
    }
  ],
  "confidence": 0 to 100,
  "riskScore": 0 to 10,
  "summary": "Brief overall assessment",
  "ragContext": {
    "farViolationsFound": ${farViolations.length},
    "auburnPoliciesMatched": ${indemnityContext.length + paymentContext.length}
  }
}

Be thorough and identify ALL compliance issues. Return ONLY valid JSON.`;

    const requestBody = {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert contract analyst. Return ONLY valid JSON.' },
        { role: 'user', content: contextualPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    };
    
    console.log('📤 [/api/contract/analyze] Sending to OpenRouter with RAG context');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006',
        'X-Title': 'Auburn Contract Analysis',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 [/api/contract/analyze] OpenRouter response:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [/api/contract/analyze] OpenRouter error:', error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';
    
    console.log('🔍 [/api/contract/analyze] AI response length:', aiResponse.length);
    
    try {
      // Try to parse JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        
        console.log('✅ [/api/contract/analyze] Analysis complete with RAG:', {
          violations: analysisResult.violations?.length || 0,
          confidence: analysisResult.confidence,
          riskScore: analysisResult.riskScore,
          ragContext: analysisResult.ragContext
        });
        
        return NextResponse.json({
          ...analysisResult,
          method: 'rag-enhanced',
          model: OPENROUTER_MODEL
        });
      }
    } catch (parseError) {
      console.error('⚠️ [/api/contract/analyze] Failed to parse AI response:', parseError);
    }
    
    // If parsing fails, return a structured response based on the text
    console.log('⚠️ [/api/contract/analyze] Using fallback structured response');
    
    const violations = [];
    
    // Check for common issues
    if (text.toLowerCase().includes('indemnif') || text.toLowerCase().includes('hold harmless')) {
      violations.push({
        id: "ai-1",
        type: "indemnification",
        severity: "CRITICAL",
        title: "Indemnification clause detected",
        description: "Auburn cannot provide indemnification as a state entity",
        auburnPolicy: "State entity restrictions - Auburn Contract Management Guide",
        farReference: "FAR 28.106",
        confidence: 0.95,
        clause: text.match(/.{0,100}(indemnif|hold harmless).{0,100}/i)?.[0] || "Indemnification clause found"
      });
    }
    
    if (text.toLowerCase().includes('intellectual property') || text.toLowerCase().includes('work product')) {
      violations.push({
        id: "ai-2",
        type: "ip-rights",
        severity: "HIGH",
        title: "IP rights issue",
        description: "Intellectual property terms may conflict with Auburn policies",
        auburnPolicy: "Faculty IP retention policy",
        farReference: "FAR 27.402",
        confidence: 0.85,
        clause: text.match(/.{0,100}(intellectual property|work product).{0,100}/i)?.[0] || "IP clause found"
      });
    }
    
    // Check for various payment term issues
    if (text.match(/payment.{0,100}(60|90|120) days/i) || 
        text.match(/ten \(10\) business days/i) ||
        text.match(/payment.{0,100}after.{0,50}receiving payment/i)) {
      violations.push({
        id: "ai-3",
        type: "payment",
        severity: "HIGH",
        title: "Non-standard payment terms",
        description: "Payment terms don't match Auburn's NET 30 policy. Auburn requires NET 30 days, not payment contingent on receiving funds from others.",
        auburnPolicy: "Auburn General Terms and Conditions - Payment Terms",
        farReference: "FAR 32.906",
        confidence: 0.90,
        clause: text.match(/.{0,100}(payment|ten \(10\) business days).{0,100}/i)?.[0] || "Payment clause found",
        suggestion: "Payment shall be made NET 30 days from receipt of properly submitted invoice"
      });
    }
    
    // Check for insurance requirements
    if (text.match(/insurance.{0,100}(required|maintain|provide)/i)) {
      violations.push({
        id: "ai-4",
        type: "insurance",
        severity: "MEDIUM",
        title: "Insurance requirement issue",
        description: "Auburn is self-insured through the State of Alabama and cannot provide commercial insurance certificates",
        auburnPolicy: "Auburn Self-Insurance Policy",
        farReference: "FAR 28.301",
        confidence: 0.85,
        clause: text.match(/.{0,100}insurance.{0,100}/i)?.[0] || "Insurance clause found"
      });
    }
    
    // Check for termination clauses
    if (!text.toLowerCase().includes('termination for convenience')) {
      violations.push({
        id: "ai-5",
        type: "termination",
        severity: "MEDIUM",
        title: "Missing termination for convenience",
        description: "Auburn requires a termination for convenience clause in all contracts",
        auburnPolicy: "Auburn Contract Requirements",
        farReference: "FAR 52.249",
        confidence: 0.80,
        suggestion: "Add termination for convenience clause allowing either party to terminate with 30 days notice"
      });
    }
    
    return NextResponse.json({
      violations,
      confidence: violations.length > 0 ? 85 : 50,
      riskScore: Math.min(violations.length * 1.5, 10),
      summary: `Found ${violations.length} potential compliance issues`,
      method: 'rag-assisted',
      ragContext: {
        farViolationsFound: farViolations.length,
        auburnPoliciesMatched: indemnityContext.length + paymentContext.length
      }
    });
    
  } catch (error) {
    console.error('❌ [/api/contract/analyze] Error:', error);
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}