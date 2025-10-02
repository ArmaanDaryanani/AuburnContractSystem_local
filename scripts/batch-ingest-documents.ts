#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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

interface DocumentToProcess {
  path: string;
  title: string;
  type: string;
  metadata?: any;
}

// Only process the remaining documents that failed
const documentsToProcess: DocumentToProcess[] = [
  {
    path: '/Users/armaandaryanani/Downloads/Auburn_University_General_Terms_And_Conditions.pdf',
    title: 'Auburn University General Terms and Conditions',
    type: 'approved_alternative',
    metadata: {
      source: 'auburn_university',
      category: 'standard_terms',
      usage: 'template',
      description: 'Standard acceptable contract language and terms'
    }
  }
];

async function parsePDFDocument(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF ${filePath}:`, error);
    throw error;
  }
}

async function batchInsertChunks(documentId: string, chunks: string[], documentTitle: string, documentType: string) {
  const BATCH_SIZE = 50; // Process 50 chunks at a time
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length));
    const embeddings = [];
    
    // Generate embeddings for this batch
    console.log(`   📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)} (chunks ${i+1}-${Math.min(i+BATCH_SIZE, chunks.length)} of ${chunks.length})`);
    
    for (const chunk of batch) {
      const embedding = await generateEmbedding(chunk);
      embeddings.push(embedding);
    }
    
    // Prepare batch insert data
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
    
    if (error) {
      console.error(`   ❌ Error inserting batch:`, error);
      failCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`   ✅ Batch inserted successfully (${successCount}/${chunks.length} chunks)`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { successCount, failCount };
}

async function processLargeDocument(doc: DocumentToProcess) {
  console.log(`\n📄 Processing: ${doc.title}`);
  console.log(`   Path: ${doc.path}`);
  console.log(`   Type: ${doc.type}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(doc.path)) {
      console.error(`   ❌ File not found: ${doc.path}`);
      return false;
    }

    // Check if document already exists
    const { data: existing } = await supabase
      .from('knowledge_documents')
      .select('id')
      .eq('title', doc.title)
      .single();
    
    if (existing) {
      console.log(`   ⚠️  Document already exists with ID: ${existing.id}`);
      console.log(`   🗑️  Removing old embeddings...`);
      
      // Delete old embeddings
      await supabase
        .from('document_embeddings')
        .delete()
        .eq('document_id', existing.id);
      
      // Delete old document
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', existing.id);
        
      console.log(`   ✅ Old document removed`);
    }

    // Parse PDF content
    console.log('   📖 Parsing PDF content...');
    const content = await parsePDFDocument(doc.path);
    
    // Get file stats
    const stats = fs.statSync(doc.path);
    const fileSizeKB = Math.round(stats.size / 1024);
    const contentLength = content.length;
    
    console.log(`   ✅ Parsed successfully!`);
    console.log(`      - File size: ${fileSizeKB} KB`);
    console.log(`      - Content length: ${contentLength} characters`);
    
    // Store document first
    console.log('   📝 Creating document record...');
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        title: doc.title,
        content: content.substring(0, 50000), // Store first 50k chars as preview
        document_type: doc.type,
        metadata: {
          ...doc.metadata,
          file_size_kb: fileSizeKB,
          character_count: contentLength,
          ingested_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (docError) {
      console.error('   ❌ Error storing document:', docError);
      return false;
    }
    
    console.log(`   ✅ Document stored with ID: ${document.id}`);
    
    // Chunk the content
    console.log('   ✂️  Chunking content...');
    const chunks = chunkText(content, 1000, 200);
    console.log(`   📄 Created ${chunks.length} chunks`);
    
    // Process chunks in batches
    console.log('   🔄 Generating embeddings and storing chunks...');
    const { successCount, failCount } = await batchInsertChunks(
      document.id, 
      chunks, 
      doc.title, 
      doc.type
    );
    
    console.log(`   ✨ Processing complete!`);
    console.log(`      - Successful chunks: ${successCount}`);
    console.log(`      - Failed chunks: ${failCount}`);
    
    return successCount > 0;
    
  } catch (error) {
    console.error(`   ❌ Error processing document:`, error);
    return false;
  }
}

async function batchProcessDocuments() {
  console.log('🚀 Batch Document Processing for Auburn Contract Review\n');
  console.log('=' .repeat(60));
  
  let successCount = 0;
  let failCount = 0;
  
  for (const doc of documentsToProcess) {
    const success = await processLargeDocument(doc);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 PROCESSING SUMMARY\n');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (successCount > 0) {
    console.log('\n✨ SUCCESS! Documents are now in your RAG system!');
    console.log('\n🎯 Your system now has:');
    
    // Get statistics
    const { count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true });
    
    const { count: embCount } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   📚 Total Documents: ${docCount}`);
    console.log(`   🔍 Total Embeddings: ${embCount}`);
    console.log(`   📊 Avg chunks per doc: ${embCount && docCount ? Math.round(embCount / docCount) : 0}`);
    
    console.log('\n💡 Test the system:');
    console.log('   npm run test-rag');
    console.log('\n🚀 Your Auburn Contract Review system is ready with REAL data!');
  }
}

// Run the batch processing
batchProcessDocuments().catch(error => {
  console.error('Fatal error during batch processing:', error);
  process.exit(1);
});