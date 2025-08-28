-- Auburn Contract Review RAG System Database Setup
-- Run this entire script in Supabase SQL Editor

-- =============================================
-- STEP 1: Enable Required Extensions
-- =============================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =============================================
-- STEP 2: Create Knowledge Base Tables
-- =============================================

-- Knowledge documents table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('far_matrix', 'auburn_policy', 'contract_template', 'approved_alternative', 'historical_contract')),
  source_file TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document embeddings table for vector search
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  contract_text TEXT NOT NULL,
  vendor_name TEXT,
  contract_type TEXT,
  status TEXT DEFAULT 'pending',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract analyses table
CREATE TABLE IF NOT EXISTS public.contract_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  analysis_type TEXT DEFAULT 'ai_rag',
  confidence_score DECIMAL(3,2),
  risk_score DECIMAL(3,2),
  compliance_status TEXT,
  total_violations INTEGER DEFAULT 0,
  critical_violations INTEGER DEFAULT 0,
  violations JSONB DEFAULT '[]',
  alternatives JSONB DEFAULT '[]',
  ai_model_used TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Violations table
CREATE TABLE IF NOT EXISTS public.violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.contract_analyses(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  description TEXT,
  clause_text TEXT,
  location JSONB DEFAULT '{}',
  far_reference TEXT,
  auburn_policy_reference TEXT,
  suggested_language TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 3: Create Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON public.document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_violations_contract_id ON public.violations(contract_id);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON public.violations(severity);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON public.document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- =============================================
-- STEP 4: Create Update Trigger
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_documents_updated_at 
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at 
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STEP 5: Create Vector Search Functions
-- =============================================

-- Main vector similarity search function
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

-- Get Auburn policy context
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

-- Get comprehensive RAG context
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
  (SELECT 
    'far_matrix'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'far_matrix'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3)
  
  UNION ALL
  
  -- Get Auburn policies
  (SELECT 
    'auburn_policy'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'auburn_policy'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3)
  
  UNION ALL
  
  -- Get approved alternatives
  (SELECT 
    'approved_alternative'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'approved_alternative'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3);
END;
$$;

-- =============================================
-- STEP 6: Enable Row Level Security (Optional)
-- =============================================

-- Enable RLS on tables
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Allow public read access to knowledge documents" 
  ON public.knowledge_documents FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to embeddings" 
  ON public.document_embeddings FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated users to manage contracts" 
  ON public.contracts FOR ALL 
  USING (true);

CREATE POLICY "Allow authenticated users to manage analyses" 
  ON public.contract_analyses FOR ALL 
  USING (true);

CREATE POLICY "Allow authenticated users to manage violations" 
  ON public.violations FOR ALL 
  USING (true);

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'knowledge_documents', 
    'document_embeddings', 
    'contracts', 
    'contract_analyses', 
    'violations'
  );

-- Verify vector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Auburn Contract Review RAG Database Setup Complete!';
  RAISE NOTICE 'Tables created: knowledge_documents, document_embeddings, contracts, contract_analyses, violations';
  RAISE NOTICE 'Vector search functions created: match_document_embeddings, get_auburn_policy_context, get_rag_context';
  RAISE NOTICE 'Next step: Run npm run seed-knowledge to populate the knowledge base';
END $$;