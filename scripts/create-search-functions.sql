-- Create search functions for RAG system

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to search FAR violations
CREATE OR REPLACE FUNCTION search_far_violations(
  query_text text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- For now, use a placeholder embedding since we're regenerating
  -- In production, this would call the embedding API
  query_embedding := array_fill(0.1, ARRAY[1536])::vector;
  
  RETURN QUERY
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) as similarity,
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type IN ('far_matrix', 'far_regulation')
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search Auburn policies
CREATE OR REPLACE FUNCTION search_auburn_policies(
  query_text text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- For now, use a placeholder embedding
  query_embedding := array_fill(0.1, ARRAY[1536])::vector;
  
  RETURN QUERY
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) as similarity,
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type IN ('auburn_policy', 'approved_alternative', 'contract_template')
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search all knowledge base
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_text text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  metadata jsonb,
  document_type text
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- For now, use a placeholder embedding
  query_embedding := array_fill(0.1, ARRAY[1536])::vector;
  
  RETURN QUERY
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) as similarity,
    de.metadata,
    kd.document_type
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_far_violations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_auburn_policies TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_base TO anon, authenticated;