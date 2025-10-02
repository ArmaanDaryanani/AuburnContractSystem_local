import { createClient } from '@supabase/supabase-js';

// Initialize Supabase database with required tables and sample data
export async function initializeDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🚀 Initializing Supabase database...');

  // Create knowledge_documents table
  const { error: docTableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT,
        document_type TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  }).single();

  if (docTableError && !docTableError.message?.includes('already exists')) {
    console.error('Error creating knowledge_documents table:', docTableError);
  }

  // Create document_embeddings table
  const { error: embTableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        chunk_text TEXT,
        chunk_index INTEGER,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  }).single();

  if (embTableError && !embTableError.message?.includes('already exists')) {
    console.error('Error creating document_embeddings table:', embTableError);
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
      console.error('Error inserting sample documents:', insertError);
    } else {
      console.log('✅ Added', docs?.length, 'sample documents');

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

        console.log('✅ Added sample embeddings');
      }
    }
  } else {
    console.log('📊 Database already contains', docCount, 'documents');
  }

  console.log('✨ Database initialization complete!');
}