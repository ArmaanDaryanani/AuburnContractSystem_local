-- Function to search for similar document chunks using cosine similarity
CREATE OR REPLACE FUNCTION match_document_embeddings(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  document_type TEXT,
  document_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_text,
    kd.document_type,
    kd.title as document_title,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    (filter_type IS NULL OR kd.document_type = filter_type)
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search for FAR violations
CREATE OR REPLACE FUNCTION search_far_violations(
  query_text TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  document_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.chunk_text,
    kd.title as document_title,
    similarity(de.chunk_text, query_text) AS similarity
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    kd.document_type = 'far_matrix'
    AND similarity(de.chunk_text, query_text) > 0.2
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to get Auburn policy context for a contract clause
CREATE OR REPLACE FUNCTION get_auburn_policy_context(
  query_embedding vector(1536),
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  policy_text TEXT,
  policy_title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.chunk_text as policy_text,
    kd.title as policy_title,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    kd.document_type IN ('auburn_policy', 'approved_alternative')
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar historical contracts
CREATE OR REPLACE FUNCTION find_similar_contracts(
  query_embedding vector(1536),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  contract_text TEXT,
  contract_title TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.chunk_text as contract_text,
    kd.title as contract_title,
    1 - (de.embedding <=> query_embedding) AS similarity,
    kd.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    kd.document_type = 'historical_contract'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get comprehensive RAG context for contract analysis
CREATE OR REPLACE FUNCTION get_rag_context(
  query_embedding vector(1536),
  context_size INT DEFAULT 10
)
RETURNS TABLE (
  context_type TEXT,
  content TEXT,
  title TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Get FAR matrix entries
  SELECT 
    'far_matrix'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'far_matrix'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3
  
  UNION ALL
  
  -- Get Auburn policies
  SELECT 
    'auburn_policy'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'auburn_policy'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3
  
  UNION ALL
  
  -- Get approved alternatives
  SELECT 
    'approved_alternative'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'approved_alternative'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3;
END;
$$;