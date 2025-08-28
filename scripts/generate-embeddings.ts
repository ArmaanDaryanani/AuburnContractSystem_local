#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables FIRST before any imports that use them
dotenv.config({ path: '.env.local' });

// Now import after env vars are loaded
import { chunkText, generateEmbedding } from '../src/lib/rag/document-ingestion';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function generateAllEmbeddings() {
  console.log('🚀 Generating embeddings for knowledge base...\n');
  
  try {
    // Get all documents without embeddings
    const { data: documents, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching documents:', error);
      return;
    }
    
    if (!documents || documents.length === 0) {
      console.log('No documents found in knowledge base');
      return;
    }
    
    console.log(`Found ${documents.length} documents to process\n`);
    
    for (const doc of documents) {
      console.log(`\n📄 Processing: ${doc.title}`);
      
      // Check if embeddings already exist
      const { data: existingEmbeddings } = await supabase
        .from('document_embeddings')
        .select('id')
        .eq('document_id', doc.id)
        .limit(1);
      
      if (existingEmbeddings && existingEmbeddings.length > 0) {
        console.log('  ⏭️  Embeddings already exist, skipping');
        continue;
      }
      
      // Chunk the document
      const chunks = chunkText(doc.content, 1000, 200);
      console.log(`  📝 Created ${chunks.length} chunks`);
      
      // Generate and store embeddings
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        
        const { error: insertError } = await supabase
          .from('document_embeddings')
          .insert({
            document_id: doc.id,
            chunk_text: chunks[i],
            chunk_index: i,
            embedding,
            metadata: {
              title: doc.title,
              document_type: doc.document_type,
              chunk_number: i + 1,
              total_chunks: chunks.length
            }
          });
        
        if (insertError) {
          console.error(`  ❌ Error storing embedding ${i + 1}:`, insertError);
        } else {
          process.stdout.write(`  ✅ Embedding ${i + 1}/${chunks.length}\r`);
        }
      }
      
      console.log(`\n  ✅ Completed ${doc.title}`);
    }
    
    console.log('\n✨ All embeddings generated successfully!');
    
    // Show statistics
    const { count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true });
    
    const { count: embCount } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n📊 Statistics:');
    console.log(`  Documents: ${docCount}`);
    console.log(`  Embeddings: ${embCount}`);
    console.log(`  Avg chunks per doc: ${embCount && docCount ? (embCount / docCount).toFixed(1) : 0}`);
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
  }
}

generateAllEmbeddings().catch(console.error);