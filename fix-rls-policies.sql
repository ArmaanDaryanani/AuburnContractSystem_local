-- Fix Row Level Security (RLS) Policies for Auburn Contract System
-- Run this in your Supabase SQL Editor to allow API access to your data

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access" ON knowledge_documents;
DROP POLICY IF EXISTS "Allow anonymous read access" ON document_embeddings;
DROP POLICY IF EXISTS "Allow service role full access" ON knowledge_documents;
DROP POLICY IF EXISTS "Allow service role full access" ON document_embeddings;

-- Option 1: RECOMMENDED - Allow service role and anon key access
-- This works with both service key and anon key

-- For knowledge_documents table
CREATE POLICY "Enable read access for all users" ON knowledge_documents
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON knowledge_documents
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON knowledge_documents
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- For document_embeddings table
CREATE POLICY "Enable read access for all users" ON document_embeddings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON document_embeddings
  FOR INSERT
  TO public
  WITH CHECK (true);

-- For contract_analyses table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'contract_analyses') THEN
        CREATE POLICY "Enable read access for all users" ON contract_analyses
          FOR SELECT
          TO public
          USING (true);
          
        CREATE POLICY "Enable insert for all users" ON contract_analyses
          FOR INSERT
          TO public
          WITH CHECK (true);
    END IF;
END $$;

-- For contracts table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'contracts') THEN
        CREATE POLICY "Enable read access for all users" ON contracts
          FOR SELECT
          TO public
          USING (true);
          
        CREATE POLICY "Enable insert for all users" ON contracts
          FOR INSERT
          TO public
          WITH CHECK (true);
    END IF;
END $$;

-- Option 2: ALTERNATIVE - If you want to completely disable RLS (less secure but simpler)
-- Uncomment these lines if Option 1 doesn't work:
-- ALTER TABLE knowledge_documents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_embeddings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE contract_analyses DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE tablename IN ('knowledge_documents', 'document_embeddings', 'contract_analyses', 'contracts')
ORDER BY tablename, policyname;