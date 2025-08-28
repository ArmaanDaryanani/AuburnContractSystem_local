import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Supabase credentials not configured',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Initializing Supabase database...');

    // Create knowledge_documents table
    const { error: docTableError } = await supabase.from('knowledge_documents').select('*').limit(1);
    
    if (docTableError?.message?.includes('relation') && docTableError?.message?.includes('does not exist')) {
      // Table doesn't exist, create it
      console.log('Creating knowledge_documents table...');
      
      // Note: Direct SQL execution requires database access
      // For now, return instructions for manual creation
      return NextResponse.json({
        error: 'Tables not found',
        message: 'Please create the following tables in Supabase SQL Editor:',
        sql: `
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

-- Enable Row Level Security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for development)
CREATE POLICY "Allow anonymous read access" ON knowledge_documents
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous read access" ON document_embeddings
  FOR SELECT USING (true);

-- Insert sample data
INSERT INTO knowledge_documents (title, document_type, content, metadata) VALUES
  ('FAR Clauses Matrix', 'far_matrix', 'Federal Acquisition Regulation clauses...', '{"file_size_mb": 12.7, "character_count": 450000}'),
  ('Auburn Procurement Policies', 'auburn_policy', 'Auburn University procurement policies...', '{"file_size_mb": 0.45, "character_count": 22500}'),
  ('Standard Contract Template', 'contract_template', 'Standard contract template...', '{"file_size_mb": 0.085, "character_count": 15000}'),
  ('Approved Alternative Clauses', 'approved_alternative', 'Pre-approved alternative clauses...', '{"file_size_mb": 0.12, "character_count": 18000}');
        `
      });
    }

    // Check if tables are empty and add sample data
    const { count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true });

    if (docCount === 0) {
      console.log('📚 Adding sample documents...');

      // Add sample documents
      const { data: docs, error: insertError } = await supabase
        .from('knowledge_documents')
        .insert([
          {
            title: 'FAR Clauses Matrix',
            document_type: 'far_matrix',
            content: 'Federal Acquisition Regulation clauses applicable to Auburn University contracts...',
            metadata: { 
              file_size_mb: 12.7, 
              character_count: 450000,
              source: 'Federal Acquisition Regulation'
            }
          },
          {
            title: 'Auburn Procurement Policies',
            document_type: 'auburn_policy',
            content: 'Auburn University procurement policies and procedures...',
            metadata: { 
              file_size_mb: 0.45, 
              character_count: 22500,
              source: 'Auburn University Policy Manual'
            }
          },
          {
            title: 'Standard Contract Template',
            document_type: 'contract_template',
            content: 'Standard contract template for Auburn University agreements...',
            metadata: { 
              file_size_mb: 0.085, 
              character_count: 15000,
              source: 'Auburn Legal Department'
            }
          },
          {
            title: 'Approved Alternative Clauses',
            document_type: 'approved_alternative',
            content: 'Pre-approved alternative clauses for common contract issues...',
            metadata: { 
              file_size_mb: 0.12, 
              character_count: 18000,
              source: 'Auburn Contract Review Board'
            }
          }
        ])
        .select();

      if (insertError) {
        return NextResponse.json({ 
          error: 'Failed to insert sample documents',
          details: insertError.message 
        }, { status: 500 });
      }

      // Add sample embeddings for each document
      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const chunks = doc.document_type === 'far_matrix' ? 150 : 
                         doc.document_type === 'auburn_policy' ? 75 :
                         doc.document_type === 'contract_template' ? 50 : 25;

          const embeddingData = [];
          for (let i = 0; i < chunks; i++) {
            embeddingData.push({
              document_id: doc.id,
              chunk_text: `${doc.title} - Chunk ${i + 1}`,
              chunk_index: i,
              metadata: { 
                document_type: doc.document_type,
                chunk_size: 512 
              }
            });
          }

          const { error: embError } = await supabase
            .from('document_embeddings')
            .insert(embeddingData);

          if (embError) {
            console.error(`Error inserting embeddings for ${doc.title}:`, embError);
          }
        }
      }

      return NextResponse.json({ 
        success: true,
        message: 'Database initialized successfully',
        documentsAdded: docs?.length || 0
      });
    }

    // Get current stats
    const { count: totalEmbeddings } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({ 
      success: true,
      message: 'Database already initialized',
      stats: {
        documents: docCount,
        embeddings: totalEmbeddings
      }
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}