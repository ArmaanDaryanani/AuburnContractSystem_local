-- Create knowledge documents table
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

-- Create document embeddings table for vector search
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create contracts table for analyzed contracts
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

-- Create contract analyses table
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

-- Create violations table
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

-- Create indexes for better performance
CREATE INDEX idx_embeddings_document_id ON public.document_embeddings(document_id);
CREATE INDEX idx_violations_contract_id ON public.violations(contract_id);
CREATE INDEX idx_violations_severity ON public.violations(severity);
CREATE INDEX idx_contracts_status ON public.contracts(status);

-- Create index for vector similarity search using IVFFlat
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON public.document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();