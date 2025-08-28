-- Supabase Database Initialization Script
-- Run this in your Supabase SQL Editor to create the required tables

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  document_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create document_embeddings table  
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_text TEXT,
  chunk_index INTEGER,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_type ON knowledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_chunk_index ON document_embeddings(chunk_index);

-- Enable Row Level Security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for development)
CREATE POLICY "Allow anonymous read access" ON knowledge_documents
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert" ON knowledge_documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON knowledge_documents
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access" ON document_embeddings
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert" ON document_embeddings
  FOR INSERT WITH CHECK (true);

-- Insert sample documents
INSERT INTO knowledge_documents (title, document_type, content, metadata) VALUES
  ('FAR Clauses Matrix', 'far_matrix', 'Federal Acquisition Regulation clauses applicable to Auburn University contracts. Includes all relevant FAR provisions for university procurement.', '{"file_size_mb": 12.7, "character_count": 450000, "source": "Federal Acquisition Regulation"}'),
  ('Auburn Procurement Policies', 'auburn_policy', 'Auburn University procurement policies and procedures. Covers indemnification restrictions, IP rights, payment terms, and insurance requirements.', '{"file_size_mb": 0.45, "character_count": 22500, "source": "Auburn University Policy Manual"}'),
  ('Standard Contract Template', 'contract_template', 'Standard contract template for Auburn University agreements. Pre-approved language for common contract scenarios.', '{"file_size_mb": 0.085, "character_count": 15000, "source": "Auburn Legal Department"}'),
  ('Approved Alternative Clauses', 'approved_alternative', 'Pre-approved alternative clauses for common contract issues. Auburn-compliant replacements for problematic vendor terms.', '{"file_size_mb": 0.12, "character_count": 18000, "source": "Auburn Contract Review Board"}')
ON CONFLICT DO NOTHING;

-- Insert sample embeddings (without actual vectors for now)
-- First, get the document IDs
WITH doc_ids AS (
  SELECT id, document_type, title FROM knowledge_documents
)
-- Insert sample chunks for each document
INSERT INTO document_embeddings (document_id, chunk_text, chunk_index, metadata)
SELECT 
  id as document_id,
  title || ' - Sample chunk ' || generate_series as chunk_text,
  generate_series - 1 as chunk_index,
  jsonb_build_object('document_type', document_type, 'chunk_size', 512) as metadata
FROM doc_ids
CROSS JOIN LATERAL (
  SELECT generate_series(
    1, 
    CASE 
      WHEN document_type = 'far_matrix' THEN 150
      WHEN document_type = 'auburn_policy' THEN 75  
      WHEN document_type = 'contract_template' THEN 50
      WHEN document_type = 'approved_alternative' THEN 25
      ELSE 10
    END
  )
) AS chunks
ON CONFLICT DO NOTHING;

-- Verify the data was inserted
SELECT 
  'Documents:' as table_name,
  COUNT(*) as count 
FROM knowledge_documents
UNION ALL
SELECT 
  'Embeddings:' as table_name,
  COUNT(*) as count 
FROM document_embeddings;