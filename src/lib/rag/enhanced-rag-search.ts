/**
 * Enhanced RAG Search with FAR Matrix and Contract Terms Support
 * This module provides specialized search functions for contract compliance
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './document-ingestion';

// Initialize Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export interface FARRequirement {
  id: string;
  far_section: string;
  requirement_text: string;
  auburn_policy: string;
  risk_level: string;
  similarity: number;
  metadata: any;
}

export interface ContractAlternative {
  id: string;
  term_type: string;
  standard_language: string;
  alternative_language: string;
  risk_level: string;
  similarity: number;
  is_auburn_approved: boolean;
}

export interface ComplianceCheckResult {
  violations: Array<{
    type: string;
    far_section?: string;
    term_type?: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    confidence: number;
    suggested_alternative?: string;
    policy_reference?: string;
  }>;
  alternatives: ContractAlternative[];
  far_requirements: FARRequirement[];
  overall_risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  compliance_score: number;
}

/**
 * Search for relevant FAR requirements based on contract text
 */
export async function searchFARRequirements(
  contractText: string,
  farSectionFilter?: string,
  limit: number = 10
): Promise<FARRequirement[]> {
  try {
    const queryEmbedding = await generateEmbedding(contractText);
    
    const { data, error } = await getSupabaseClient().rpc('search_far_requirements', {
      query_embedding: queryEmbedding,
      far_section_filter: farSectionFilter || null,
      risk_level_filter: null,
      match_count: limit
    } as any);
    
    if (error) {
      console.error('Error searching FAR requirements:', error);
      return [];
    }
    
    const results = data as any[] || [];
    return results.map((item: any) => ({
      id: item.id,
      far_section: item.far_section,
      requirement_text: item.chunk_text,
      auburn_policy: item.metadata?.policy_reference || '',
      risk_level: item.risk_level || 'Standard',
      similarity: item.similarity,
      metadata: item.metadata
    }));
  } catch (error) {
    console.error('Error in searchFARRequirements:', error);
    return [];
  }
}

/**
 * Search for Auburn-approved alternative language
 */
export async function searchAuburnAlternatives(
  contractClause: string,
  termType?: string,
  limit: number = 5
): Promise<ContractAlternative[]> {
  try {
    const queryEmbedding = await generateEmbedding(contractClause);
    
    const { data, error } = await getSupabaseClient().rpc('search_auburn_alternatives', {
      query_embedding: queryEmbedding,
      term_type_filter: termType || null,
      match_count: limit
    } as any);
    
    if (error) {
      console.error('Error searching Auburn alternatives:', error);
      return [];
    }
    
    const results = data as any[] || [];
    return results.map((item: any) => ({
      id: item.id,
      term_type: item.term_type || '',
      standard_language: item.language_type === 'standard' ? item.chunk_text : '',
      alternative_language: item.language_type === 'alternative' ? item.chunk_text : '',
      risk_level: item.risk_level || 'Standard',
      similarity: item.similarity,
      is_auburn_approved: item.metadata?.is_auburn_approved || false
    }));
  } catch (error) {
    console.error('Error in searchAuburnAlternatives:', error);
    return [];
  }
}

/**
 * Perform comprehensive compliance check on contract text
 */
export async function performComplianceCheck(
  contractText: string,
  options: {
    checkFAR?: boolean;
    checkAuburnPolicies?: boolean;
    includeAlternatives?: boolean;
    minConfidence?: number;
  } = {}
): Promise<ComplianceCheckResult> {
  const {
    checkFAR = true,
    checkAuburnPolicies = true,
    includeAlternatives = true,
    minConfidence = 0.7
  } = options;
  
  const violations = [];
  let alternatives: ContractAlternative[] = [];
  let farRequirements: FARRequirement[] = [];
  
  try {
    // Check FAR compliance
    if (checkFAR) {
      farRequirements = await searchFARRequirements(contractText, undefined, 15);
      
      // Analyze FAR requirements for potential violations
      for (const req of farRequirements) {
        if (req.similarity > minConfidence && req.risk_level !== 'LOW') {
          violations.push({
            type: 'FAR_REQUIREMENT',
            far_section: req.far_section,
            term_type: undefined,
            description: `Potential FAR ${req.far_section} compliance issue: ${req.requirement_text}`,
            severity: (req.risk_level === 'CRITICAL' ? 'CRITICAL' : 
                     req.risk_level === 'HIGH' ? 'HIGH' : 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            confidence: req.similarity,
            suggested_alternative: undefined,
            policy_reference: req.auburn_policy
          });
        }
      }
    }
    
    // Search for Auburn alternatives
    if (includeAlternatives) {
      alternatives = await searchAuburnAlternatives(contractText, undefined, 10);
      
      // Add alternatives as suggestions
      for (const alt of alternatives) {
        if (alt.similarity > minConfidence && alt.is_auburn_approved) {
          const existingViolation = violations.find(v => 
            v.term_type === alt.term_type || (v.description && v.description.includes(alt.term_type))
          );
          
          if (existingViolation && existingViolation.suggested_alternative === undefined) {
            existingViolation.suggested_alternative = alt.alternative_language;
          }
        }
      }
    }
    
    // Check Auburn-specific policies
    if (checkAuburnPolicies) {
      // Search for policy violations using general embedding search
      const queryEmbedding = await generateEmbedding(contractText);
      
      const { data: policyData } = await getSupabaseClient().rpc('match_document_embeddings', {
        query_embedding: queryEmbedding,
        match_count: 10,
        filter_type: 'auburn_policy'
      } as any);
      
      const policies = policyData as any[] || [];
      for (const policy of policies) {
        if (policy.similarity > minConfidence) {
          violations.push({
            type: 'AUBURN_POLICY',
            far_section: undefined,
            term_type: undefined,
            description: `Auburn policy consideration: ${policy.chunk_text}`,
            severity: 'MEDIUM' as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            confidence: policy.similarity,
            suggested_alternative: undefined,
            policy_reference: policy.document_title
          });
        }
      }
    }
    
    // Calculate overall risk and compliance score
    const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
    const highCount = violations.filter(v => v.severity === 'HIGH').length;
    const mediumCount = violations.filter(v => v.severity === 'MEDIUM').length;
    
    const overall_risk = criticalCount > 0 ? 'CRITICAL' :
                        highCount > 0 ? 'HIGH' :
                        mediumCount > 0 ? 'MEDIUM' : 'LOW';
    
    const compliance_score = Math.max(0, 100 - (criticalCount * 30 + highCount * 15 + mediumCount * 5));
    
    return {
      violations,
      alternatives,
      far_requirements: farRequirements,
      overall_risk,
      compliance_score
    };
  } catch (error) {
    console.error('Error in performComplianceCheck:', error);
    return {
      violations: [],
      alternatives: [],
      far_requirements: [],
      overall_risk: 'LOW',
      compliance_score: 100
    };
  }
}

/**
 * Build an enhanced prompt with FAR and Auburn policy context
 */
export async function buildEnhancedCompliancePrompt(
  contractText: string,
  options: {
    includeFAR?: boolean;
    includeAlternatives?: boolean;
    includeHistorical?: boolean;
  } = {}
): Promise<string> {
  const {
    includeFAR = true,
    includeAlternatives = true
  } = options;
  
  try {
    let prompt = `
AUBURN UNIVERSITY CONTRACT COMPLIANCE ANALYSIS
==============================================

You are analyzing a contract for Auburn University compliance with FAR requirements and Auburn-specific policies.

`;
    
    // Add FAR requirements context
    if (includeFAR) {
      const farReqs = await searchFARRequirements(contractText, undefined, 10);
      if (farReqs.length > 0) {
        prompt += `\nRELEVANT FAR REQUIREMENTS:\n`;
        prompt += `==========================\n`;
        farReqs.forEach(req => {
          prompt += `\nFAR ${req.far_section}:\n`;
          prompt += `Requirement: ${req.requirement_text}\n`;
          prompt += `Auburn Policy: ${req.auburn_policy}\n`;
          prompt += `Risk Level: ${req.risk_level}\n`;
          prompt += `---\n`;
        });
      }
    }
    
    // Add Auburn alternatives
    if (includeAlternatives) {
      const alternatives = await searchAuburnAlternatives(contractText, undefined, 8);
      if (alternatives.length > 0) {
        prompt += `\nAUBURN-APPROVED ALTERNATIVE LANGUAGE:\n`;
        prompt += `=====================================\n`;
        alternatives.forEach(alt => {
          prompt += `\nTerm Type: ${alt.term_type}\n`;
          if (alt.standard_language) {
            prompt += `Standard: ${alt.standard_language}\n`;
          }
          if (alt.alternative_language) {
            prompt += `Auburn Alternative: ${alt.alternative_language}\n`;
          }
          prompt += `Risk Level: ${alt.risk_level}\n`;
          prompt += `---\n`;
        });
      }
    }
    
    // Add contract text
    prompt += `\nCONTRACT TEXT TO ANALYZE:\n`;
    prompt += `========================\n`;
    prompt += contractText;
    prompt += `\n\nINSTRUCTIONS:\n`;
    prompt += `=============\n`;
    prompt += `1. Identify specific violations of FAR requirements or Auburn policies\n`;
    prompt += `2. Reference the exact FAR section or policy for each violation\n`;
    prompt += `3. Assign risk levels (CRITICAL, HIGH, MEDIUM, LOW) to each finding\n`;
    prompt += `4. Suggest Auburn-approved alternative language where available\n`;
    prompt += `5. Provide a confidence score (0-1) for each finding\n`;
    prompt += `6. Format response as structured JSON\n`;
    
    return prompt;
  } catch (error) {
    console.error('Error building enhanced compliance prompt:', error);
    return `Analyze this contract for Auburn University compliance: ${contractText}`;
  }
}

/**
 * Get contract review recommendations based on term type
 */
export async function getContractRecommendations(
  termType: string,
  currentLanguage: string
): Promise<{
  recommended: string;
  alternatives: string[];
  riskAssessment: string;
  complianceNotes: string;
}> {
  try {
    // Search for similar terms and alternatives
    const alternatives = await searchAuburnAlternatives(currentLanguage, termType, 5);
    
    // Get the best alternative
    const bestAlternative = alternatives
      .filter(alt => alt.is_auburn_approved && alt.similarity > 0.8)
      .sort((a, b) => b.similarity - a.similarity)[0];
    
    // Compile recommendations
    return {
      recommended: bestAlternative?.alternative_language || 
                   'No specific Auburn-approved language found for this term type.',
      alternatives: alternatives
        .filter(alt => alt.alternative_language)
        .map(alt => alt.alternative_language)
        .slice(0, 3),
      riskAssessment: bestAlternative?.risk_level || 'Standard',
      complianceNotes: `This ${termType} clause should be reviewed for FAR compliance and Auburn policy alignment.`
    };
  } catch (error) {
    console.error('Error getting contract recommendations:', error);
    return {
      recommended: '',
      alternatives: [],
      riskAssessment: 'Unknown',
      complianceNotes: 'Unable to retrieve recommendations at this time.'
    };
  }
}

/**
 * Search for specific FAR violations in contract text
 */
export async function searchSpecificFARViolations(
  contractText: string,
  farSections: string[]
): Promise<Array<{
  farSection: string;
  violated: boolean;
  confidence: number;
  details: string;
}>> {
  const results = [];
  
  for (const section of farSections) {
    const requirements = await searchFARRequirements(contractText, section, 3);
    
    if (requirements.length > 0) {
      const topMatch = requirements[0];
      results.push({
        farSection: section,
        violated: topMatch.similarity > 0.75,
        confidence: topMatch.similarity,
        details: topMatch.requirement_text
      });
    } else {
      results.push({
        farSection: section,
        violated: false,
        confidence: 0,
        details: 'No matching requirements found'
      });
    }
  }
  
  return results;
}