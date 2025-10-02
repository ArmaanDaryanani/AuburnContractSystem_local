#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import after env vars are loaded
import { chunkText, generateEmbedding } from '../src/lib/rag/document-ingestion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function cleanDatabase() {
  console.log('🧹 Cleaning database completely...\n');
  
  // Delete ALL embeddings
  console.log('   🗑️  Deleting all embeddings...');
  const { error: embError } = await supabase
    .from('document_embeddings')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
  
  if (embError) {
    console.error('Error deleting embeddings:', embError);
  } else {
    console.log('   ✅ All embeddings deleted');
  }
  
  // Delete ALL documents
  console.log('   🗑️  Deleting all documents...');
  const { error: docError } = await supabase
    .from('knowledge_documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
  
  if (docError) {
    console.error('Error deleting documents:', docError);
  } else {
    console.log('   ✅ All documents deleted');
  }
  
  console.log('   ✨ Database cleaned!\n');
}

async function parsePDFDocument(filePath: string): Promise<string> {
  try {
    console.log('   📖 Parsing PDF...');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log('   ✅ PDF parsed successfully');
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF:`, error);
    throw error;
  }
}

async function batchInsertChunks(documentId: string, chunks: string[], documentTitle: string, documentType: string) {
  const BATCH_SIZE = 200; // Larger batches for speed
  let successCount = 0;
  const startTime = Date.now();
  
  console.log(`\n   🔄 Processing ${chunks.length} chunks in batches of ${BATCH_SIZE}...`);
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length));
    const progress = Math.round((i / chunks.length) * 100);
    
    process.stdout.write(`\r   📦 Progress: ${progress}% (${i}/${chunks.length} chunks)`);
    
    // Generate embeddings for batch
    const embeddings = [];
    for (const chunk of batch) {
      embeddings.push(await generateEmbedding(chunk));
    }
    
    // Prepare insert data
    const insertData = batch.map((chunk, index) => ({
      document_id: documentId,
      chunk_text: chunk,
      chunk_index: i + index,
      embedding: embeddings[index],
      metadata: {
        title: documentTitle,
        document_type: documentType,
        chunk_number: i + index + 1,
        total_chunks: chunks.length
      }
    }));
    
    // Insert batch
    const { error } = await supabase
      .from('document_embeddings')
      .insert(insertData);
    
    if (!error) {
      successCount += batch.length;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n   ✅ Completed in ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`   📊 Inserted ${successCount}/${chunks.length} chunks`);
  
  return successCount;
}

async function ingestAllDocuments() {
  const documents = [
    {
      path: '/Users/armaandaryanani/Downloads/FAR.pdf',
      title: 'Federal Acquisition Regulation (FAR)',
      type: 'far_matrix'
    },
    {
      path: '/Users/armaandaryanani/Downloads/AU-Contract-Mgt-Guide-2015.pdf',
      title: 'Auburn Contract Management Guide',
      type: 'auburn_policy'
    },
    {
      path: '/Users/armaandaryanani/Downloads/Auburn_University_General_Terms_And_Conditions.pdf',
      title: 'Auburn General Terms and Conditions',
      type: 'approved_alternative'
    },
    {
      path: '/Users/armaandaryanani/Downloads/FromRiskManagement-VendorExhibitorAGREEMENT2021-Accessible.pdf',
      title: 'Vendor Agreement Form 2021',
      type: 'contract_template'
    }
  ];
  
  for (const doc of documents) {
    console.log(`\n📄 Processing: ${doc.title}`);
    
    if (!fs.existsSync(doc.path)) {
      console.error(`   ❌ File not found: ${doc.path}`);
      continue;
    }
    
    // Parse PDF
    const content = await parsePDFDocument(doc.path);
    const fileSizeMB = (fs.statSync(doc.path).size / 1024 / 1024).toFixed(2);
    
    console.log(`   📊 Size: ${fileSizeMB} MB, Length: ${content.length.toLocaleString()} chars`);
    
    // Store document
    const { data: document, error } = await supabase
      .from('knowledge_documents')
      .insert({
        title: doc.title,
        content: content.substring(0, 50000),
        document_type: doc.type,
        metadata: {
          file_size_mb: fileSizeMB,
          character_count: content.length,
          ingested_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('   ❌ Error storing document:', error);
      continue;
    }
    
    // Chunk and insert
    const chunks = chunkText(content, 1000, 200);
    console.log(`   📄 Created ${chunks.length.toLocaleString()} chunks`);
    
    const count = await batchInsertChunks(document.id, chunks, doc.title, doc.type);
    console.log(`   ✨ Document ingested successfully!\n`);
  }
}

async function main() {
  console.log('🚀 Complete RAG System Setup\n');
  console.log('=' .repeat(60));
  
  // Step 1: Clean database
  await cleanDatabase();
  
  // Step 2: Ingest all documents
  console.log('📚 Starting document ingestion...\n');
  await ingestAllDocuments();
  
  // Step 3: Show statistics
  const { count: docCount } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true });
  
  const { count: embCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true });
  
  console.log('=' .repeat(60));
  console.log('\n✨ SUCCESS! RAG System Setup Complete!\n');
  console.log('📊 Final Statistics:');
  console.log(`   📚 Documents: ${docCount}`);
  console.log(`   🔍 Embeddings: ${embCount?.toLocaleString()}`);
  console.log('\n🎯 Your Auburn Contract Review system is ready!');
  console.log('   - Complete FAR regulations');
  console.log('   - Auburn policies and guidelines');
  console.log('   - General terms and conditions');
  console.log('   - Vendor agreement templates');
  console.log('\n💡 Test with: npm run test-rag\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});