-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS search_far_violations CASCADE;
DROP FUNCTION IF EXISTS search_auburn_policies CASCADE;
DROP FUNCTION IF EXISTS search_knowledge_base CASCADE;

-- Create improved search function for FAR violations
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
LANGUAGE sql
STABLE
AS $$
  -- For now, return top matches based on text search
  -- In production, this would use embedding similarity
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1.0 as similarity,  -- Placeholder similarity
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'far_matrix'
    AND de.chunk_text ILIKE '%' || query_text || '%'
  ORDER BY de.chunk_index
  LIMIT match_count;
$$;

-- Create improved search function for Auburn policies
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
LANGUAGE sql
STABLE
AS $$
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1.0 as similarity,
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type IN ('auburn_policy', 'approved_alternative', 'contract_template')
    AND de.chunk_text ILIKE '%' || query_text || '%'
  ORDER BY de.chunk_index
  LIMIT match_count;
$$;

-- Create general knowledge base search
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
LANGUAGE sql
STABLE
AS $$
  SELECT 
    de.id,
    de.document_id,
    de.chunk_text,
    1.0 as similarity,
    de.metadata,
    kd.document_type
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE de.chunk_text ILIKE '%' || query_text || '%'
  ORDER BY de.chunk_index
  LIMIT match_count;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_far_violations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_auburn_policies TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_knowledge_base TO anon, authenticated, service_role;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON knowledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_text ON document_embeddings USING gin(to_tsvector('english', chunk_text));