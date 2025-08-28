import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './document-ingestion';

// Lazy initialize Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.error('Supabase config missing:', {
        hasUrl: !!url,
        hasKey: !!key,
        urlPrefix: url?.substring(0, 30)
      });
      throw new Error(`Supabase environment variables not configured. URL: ${!!url}, Key: ${!!key}`);
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export interface SearchResult {
  id: string;
  document_id: string;
  chunk_text: string;
  document_type: string;
  document_title: string;
  similarity: number;
}

export interface PolicyContext {
  policy_text: string;
  policy_title: string;
  similarity: number;
}

export interface RAGContext {
  context_type: string;
  content: string;
  title: string;
  relevance: number;
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
  query: string,
  limit: number = 5,
  documentType?: string
): Promise<SearchResult[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Call the Supabase function
    const { data, error } = await getSupabaseClient().rpc('match_document_embeddings', {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_type: documentType || null
    } as any);
    
    if (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in searchSimilarDocuments:', error);
    return [];
  }
}

/**
 * Get Auburn policy context for a specific contract clause
 */
export async function getAuburnPolicyContext(
  clauseText: string,
  limit: number = 3
): Promise<PolicyContext[]> {
  try {
    const queryEmbedding = await generateEmbedding(clauseText);
    
    const { data, error } = await getSupabaseClient().rpc('get_auburn_policy_context', {
      query_embedding: queryEmbedding,
      match_count: limit
    } as any);
    
    if (error) {
      console.error('Error getting policy context:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAuburnPolicyContext:', error);
    return [];
  }
}

/**
 * Get comprehensive RAG context for contract analysis
 */
export async function getRAGContext(
  contractText: string,
  contextSize: number = 10
): Promise<RAGContext[]> {
  try {
    const queryEmbedding = await generateEmbedding(contractText);
    
    const { data, error } = await getSupabaseClient().rpc('get_rag_context', {
      query_embedding: queryEmbedding,
      context_size: contextSize
    } as any);
    
    if (error) {
      console.error('Error getting RAG context:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRAGContext:', error);
    return [];
  }
}

/**
 * Search for FAR violations using text similarity
 */
export async function searchFARViolations(
  contractClause: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('search_far_violations', {
      query_text: contractClause,
      match_count: limit
    } as any);
    
    if (error) {
      console.error('Error searching FAR violations:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in searchFARViolations:', error);
    return [];
  }
}

/**
 * Find similar historical contracts
 */
export async function findSimilarContracts(
  contractText: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const queryEmbedding = await generateEmbedding(contractText);
    
    const { data, error } = await getSupabaseClient().rpc('find_similar_contracts', {
      query_embedding: queryEmbedding,
      match_count: limit
    } as any);
    
    if (error) {
      console.error('Error finding similar contracts:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in findSimilarContracts:', error);
    return [];
  }
}

/**
 * Search the knowledge base for relevant information
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<any[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search across all document types in knowledge base
    const { data, error } = await getSupabaseClient().rpc('match_document_embeddings', {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_type: null // Search all document types
    } as any);
    
    if (error) {
      console.error('Error searching knowledge base:', error);
      throw error;
    }
    
    console.log(`[RAG] Knowledge base search for "${query.substring(0, 50)}..." returned ${(data as any)?.length || 0} results`);
    
    return data || [];
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return [];
  }
}

/**
 * Build enhanced prompt with RAG context
 */
export async function buildEnhancedPrompt(
  contractText: string,
  includeHistorical: boolean = false
): Promise<string> {
  try {
    // Get relevant context from knowledge base
    const ragContext = await getRAGContext(contractText, 12);
    
    // Organize context by type
    const farPolicies = ragContext.filter(c => c.context_type === 'far_matrix');
    const auburnPolicies = ragContext.filter(c => c.context_type === 'auburn_policy');
    const alternatives = ragContext.filter(c => c.context_type === 'approved_alternative');
    
    // Build the enhanced prompt
    let enhancedPrompt = `
AUBURN UNIVERSITY CONTRACT REVIEW SYSTEM
=========================================

You are analyzing a contract for Auburn University compliance. Use the following specific policies and requirements:

FAR COMPLIANCE REQUIREMENTS:
${farPolicies.map(p => `- ${p.title}: ${p.content}`).join('\n')}

AUBURN UNIVERSITY SPECIFIC POLICIES:
${auburnPolicies.map(p => `- ${p.title}: ${p.content}`).join('\n')}

PRE-APPROVED ALTERNATIVE LANGUAGE:
${alternatives.map(a => `- ${a.title}: ${a.content}`).join('\n')}
`;
    
    if (includeHistorical) {
      const similarContracts = await findSimilarContracts(contractText, 3);
      if (similarContracts.length > 0) {
        enhancedPrompt += `\n\nSIMILAR HISTORICAL CONTRACTS:
${similarContracts.map(c => `- ${c.contract_title}: ${c.contract_text.substring(0, 200)}...`).join('\n')}
`;
      }
    }
    
    enhancedPrompt += `\n\nCONTRACT TO ANALYZE:
${contractText}

Please analyze this contract and identify:
1. Specific violations of Auburn policies or FAR requirements (reference the exact policy)
2. Risk level for each violation (CRITICAL, HIGH, MEDIUM, LOW)
3. Specific alternative language from the pre-approved alternatives above
4. Confidence score for each finding

Format your response as structured JSON.`;
    
    return enhancedPrompt;
  } catch (error) {
    console.error('Error building enhanced prompt:', error);
    // Fallback to basic prompt if RAG fails
    return `Analyze this contract for Auburn University compliance issues: ${contractText}`;
  }
}