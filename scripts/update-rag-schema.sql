-- Enhanced RAG Database Schema for FAR Matrix and Contract Terms
-- Run this in Supabase SQL Editor after the initial setup

-- =============================================
-- STEP 1: Add specialized columns for FAR/Contract data
-- =============================================

-- Add columns to document_embeddings if they don't exist
DO $$ 
BEGIN
  -- Add FAR-specific columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'document_embeddings' 
    AND column_name = 'far_section'
  ) THEN
    ALTER TABLE public.document_embeddings 
    ADD COLUMN far_section TEXT,
    ADD COLUMN compliance_level TEXT,
    ADD COLUMN has_auburn_alternative BOOLEAN DEFAULT FALSE,
    ADD COLUMN term_type TEXT,
    ADD COLUMN language_type TEXT CHECK (language_type IN ('standard', 'alternative', 'comparison', NULL)),
    ADD COLUMN risk_level TEXT CHECK (risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'Standard', NULL)),
    ADD COLUMN is_auburn_approved BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- =============================================
-- STEP 2: Create optimized indexes for FAR/Contract queries
-- =============================================

-- Drop existing indexes if they exist to avoid conflicts
DROP INDEX IF EXISTS idx_far_section;
DROP INDEX IF EXISTS idx_compliance_level;
DROP INDEX IF EXISTS idx_term_type;
DROP INDEX IF EXISTS idx_risk_level;
DROP INDEX IF EXISTS idx_language_type;
DROP INDEX IF EXISTS idx_auburn_approved;

-- Create new optimized indexes
CREATE INDEX idx_far_section ON public.document_embeddings(far_section) 
WHERE far_section IS NOT NULL;

CREATE INDEX idx_compliance_level ON public.document_embeddings(compliance_level) 
WHERE compliance_level IS NOT NULL;

CREATE INDEX idx_term_type ON public.document_embeddings(term_type) 
WHERE term_type IS NOT NULL;

CREATE INDEX idx_risk_level ON public.document_embeddings(risk_level) 
WHERE risk_level IS NOT NULL;

CREATE INDEX idx_language_type ON public.document_embeddings(language_type) 
WHERE language_type IS NOT NULL;

CREATE INDEX idx_auburn_approved ON public.document_embeddings(is_auburn_approved) 
WHERE is_auburn_approved = TRUE;

-- Composite index for common FAR queries
CREATE INDEX idx_far_risk_composite ON public.document_embeddings(far_section, risk_level) 
WHERE far_section IS NOT NULL;

-- Composite index for contract terms queries
CREATE INDEX idx_term_language_composite ON public.document_embeddings(term_type, language_type) 
WHERE term_type IS NOT NULL;

-- =============================================
-- STEP 3: Create specialized search functions
-- =============================================

-- Function to search FAR compliance requirements
CREATE OR REPLACE FUNCTION search_far_requirements(
  query_embedding vector(1536),
  far_section_filter TEXT DEFAULT NULL,
  risk_level_filter TEXT DEFAULT NULL,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  far_section TEXT,
  risk_level TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_text,
    de.far_section,
    de.risk_level,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    kd.document_type IN ('far_matrix', 'far_compliance')
    AND (far_section_filter IS NULL OR de.far_section ILIKE '%' || far_section_filter || '%')
    AND (risk_level_filter IS NULL OR de.risk_level = risk_level_filter)
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search Auburn-approved alternatives
CREATE OR REPLACE FUNCTION search_auburn_alternatives(
  query_embedding vector(1536),
  term_type_filter TEXT DEFAULT NULL,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  term_type TEXT,
  language_type TEXT,
  risk_level TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_text,
    de.term_type,
    de.language_type,
    de.risk_level,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.metadata
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE 
    (kd.document_type IN ('approved_alternative', 'contract_terms', 'term_comparison'))
    AND (de.is_auburn_approved = TRUE OR de.language_type IN ('alternative', 'comparison'))
    AND (term_type_filter IS NULL OR de.term_type ILIKE '%' || term_type_filter || '%')
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enhanced RAG context function with FAR/Contract awareness
CREATE OR REPLACE FUNCTION get_enhanced_rag_context(
  query_embedding vector(1536),
  context_size INT DEFAULT 15
)
RETURNS TABLE (
  context_type TEXT,
  content TEXT,
  title TEXT,
  relevance FLOAT,
  far_section TEXT,
  term_type TEXT,
  risk_level TEXT,
  is_auburn_approved BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Get FAR matrix requirements
  (SELECT 
    'far_requirement'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance,
    de.far_section,
    NULL::TEXT as term_type,
    de.risk_level,
    FALSE as is_auburn_approved
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'far_matrix'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3)
  
  UNION ALL
  
  -- Get Auburn-approved alternatives
  (SELECT 
    'auburn_alternative'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance,
    NULL::TEXT as far_section,
    de.term_type,
    de.risk_level,
    TRUE as is_auburn_approved
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE (kd.document_type = 'approved_alternative' OR de.is_auburn_approved = TRUE)
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3)
  
  UNION ALL
  
  -- Get standard contract terms for comparison
  (SELECT 
    'contract_standard'::TEXT as context_type,
    de.chunk_text as content,
    kd.title,
    1 - (de.embedding <=> query_embedding) AS relevance,
    NULL::TEXT as far_section,
    de.term_type,
    de.risk_level,
    FALSE as is_auburn_approved
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  WHERE kd.document_type = 'contract_terms'
    AND de.language_type = 'standard'
    AND de.embedding IS NOT NULL
  ORDER BY de.embedding <=> query_embedding
  LIMIT context_size / 3)
  
  ORDER BY relevance DESC;
END;
$$;

-- Function to find contract violations based on FAR requirements
CREATE OR REPLACE FUNCTION check_far_violations(
  contract_text TEXT,
  query_embedding vector(1536),
  threshold FLOAT DEFAULT 0.75
)
RETURNS TABLE (
  violation_type TEXT,
  far_section TEXT,
  requirement TEXT,
  risk_level TEXT,
  similarity FLOAT,
  suggested_alternative TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH far_matches AS (
    SELECT 
      de.far_section,
      de.chunk_text as requirement,
      de.risk_level,
      1 - (de.embedding <=> query_embedding) AS similarity,
      de.metadata
    FROM document_embeddings de
    JOIN knowledge_documents kd ON de.document_id = kd.id
    WHERE kd.document_type = 'far_matrix'
      AND de.embedding IS NOT NULL
      AND 1 - (de.embedding <=> query_embedding) > threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT 20
  ),
  alternatives AS (
    SELECT 
      de.term_type,
      de.chunk_text as alternative_text,
      1 - (de.embedding <=> query_embedding) AS alt_similarity
    FROM document_embeddings de
    JOIN knowledge_documents kd ON de.document_id = kd.id
    WHERE de.is_auburn_approved = TRUE
      AND de.embedding IS NOT NULL
    ORDER BY de.embedding <=> query_embedding
    LIMIT 10
  )
  SELECT 
    'FAR_VIOLATION'::TEXT as violation_type,
    fm.far_section,
    fm.requirement,
    fm.risk_level,
    fm.similarity,
    (SELECT alternative_text FROM alternatives 
     WHERE alt_similarity > 0.7 
     LIMIT 1) as suggested_alternative
  FROM far_matches fm
  WHERE fm.similarity > threshold;
END;
$$;

-- =============================================
-- STEP 4: Create materialized view for common queries
-- =============================================

-- Drop if exists
DROP MATERIALIZED VIEW IF EXISTS far_compliance_summary;

-- Create materialized view for FAR compliance summary
CREATE MATERIALIZED VIEW far_compliance_summary AS
SELECT 
  DISTINCT ON (far_section)
  far_section,
  risk_level,
  COUNT(*) OVER (PARTITION BY far_section) as requirement_count,
  BOOL_OR(has_auburn_alternative) OVER (PARTITION BY far_section) as has_alternatives,
  metadata->>'category' as category
FROM document_embeddings
WHERE far_section IS NOT NULL
ORDER BY far_section, created_at DESC;

-- Create index on materialized view
CREATE INDEX idx_far_compliance_summary_section 
ON far_compliance_summary(far_section);

-- =============================================
-- STEP 5: Create audit and tracking tables
-- =============================================

-- Table to track ingestion history
CREATE TABLE IF NOT EXISTS public.ingestion_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT,
  document_type TEXT,
  chunks_created INTEGER,
  embeddings_created INTEGER,
  processing_time_ms INTEGER,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Table to track compliance checks
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id),
  far_sections_checked TEXT[],
  violations_found INTEGER DEFAULT 0,
  alternatives_suggested INTEGER DEFAULT 0,
  check_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 6: Update RLS policies for new tables
-- =============================================

ALTER TABLE public.ingestion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view ingestion history" 
  ON public.ingestion_history FOR SELECT 
  USING (true);

CREATE POLICY "Allow authenticated users to manage compliance checks" 
  ON public.compliance_checks FOR ALL 
  USING (true);

-- =============================================
-- VERIFICATION
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced RAG schema update complete!';
  RAISE NOTICE 'New columns added: far_section, compliance_level, term_type, language_type, risk_level';
  RAISE NOTICE 'New functions: search_far_requirements, search_auburn_alternatives, check_far_violations';
  RAISE NOTICE 'New tables: ingestion_history, compliance_checks';
  RAISE NOTICE 'Materialized view: far_compliance_summary';
  RAISE NOTICE 'Ready for FAR Matrix and Contract Terms ingestion!';
END $$;