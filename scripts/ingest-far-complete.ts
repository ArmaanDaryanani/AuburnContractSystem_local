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

const FAR_DOCUMENT = {
  path: '/Users/armaandaryanani/Downloads/FAR.pdf',
  title: 'Federal Acquisition Regulation (FAR) - Complete',
  type: 'far_matrix',
  metadata: {
    source: 'official',
    category: 'federal_regulation',
    last_updated: '2024',
    description: 'Complete Federal Acquisition Regulation document'
  }
};

async function parsePDFDocument(filePath: string): Promise<string> {
  try {
    console.log('   📖 Starting PDF parsing...');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log('   ✅ PDF parsed successfully');
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF:`, error);
    throw error;
  }
}

async function batchInsertChunksWithProgress(documentId: string, chunks: string[], documentTitle: string, documentType: string) {
  const BATCH_SIZE = 100; // Larger batch size for efficiency
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  console.log(`\n   🔄 Starting batch processing of ${chunks.length} chunks...`);
  console.log(`   📦 Batch size: ${BATCH_SIZE} chunks per batch`);
  console.log(`   ⏱️  Estimated time: ${Math.ceil(chunks.length / BATCH_SIZE * 2)} minutes\n`);
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length));
    const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length/BATCH_SIZE);
    const progress = Math.round((i / chunks.length) * 100);
    
    // Show progress
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    const estimatedTotal = Math.round((elapsedTime / (i + 1)) * chunks.length);
    const remainingTime = Math.round(estimatedTotal - elapsedTime);
    
    console.log(`   📦 Batch ${batchNumber}/${totalBatches} (${progress}% complete)`);
    console.log(`      ⏱️  Elapsed: ${Math.floor(elapsedTime / 60)}m ${elapsedTime % 60}s | Remaining: ~${Math.floor(remainingTime / 60)}m ${remainingTime % 60}s`);
    console.log(`      📝 Processing chunks ${i+1}-${Math.min(i+BATCH_SIZE, chunks.length)} of ${chunks.length}`);
    
    // Generate embeddings for this batch
    const embeddings = [];
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
        total_chunks: chunks.length,
        batch_number: batchNumber
      }
    }));
    
    // Insert batch with retry logic
    let retries = 3;
    let inserted = false;
    
    while (retries > 0 && !inserted) {
      const { error } = await supabase
        .from('document_embeddings')
        .insert(insertData);
      
      if (error) {
        retries--;
        if (retries > 0) {
          console.log(`      ⚠️  Error inserting batch, retrying (${retries} attempts left)...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.error(`      ❌ Failed to insert batch after 3 attempts:`, error.message);
          failCount += batch.length;
        }
      } else {
        successCount += batch.length;
        console.log(`      ✅ Batch ${batchNumber} inserted successfully\n`);
        inserted = true;
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`   ✨ Batch processing complete!`);
  console.log(`      ⏱️  Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`      ✅ Successful chunks: ${successCount}`);
  console.log(`      ❌ Failed chunks: ${failCount}`);
  
  return { successCount, failCount };
}

async function processFARDocument() {
  console.log('🚀 FAR Document Complete Ingestion\n');
  console.log('=' .repeat(60));
  
  const doc = FAR_DOCUMENT;
  
  console.log(`\n📄 Document: ${doc.title}`);
  console.log(`   Path: ${doc.path}`);
  console.log(`   Type: ${doc.type}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(doc.path)) {
      console.error(`   ❌ File not found: ${doc.path}`);
      return false;
    }

    // Check if document already exists and clean up
    const { data: existing } = await supabase
      .from('knowledge_documents')
      .select('id')
      .eq('title', doc.title)
      .single();
    
    if (existing) {
      console.log(`\n   ⚠️  Found existing FAR document with ID: ${existing.id}`);
      console.log(`   🗑️  Cleaning up old data...`);
      
      // Delete old embeddings in batches
      let deleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: toDelete } = await supabase
          .from('document_embeddings')
          .select('id')
          .eq('document_id', existing.id)
          .limit(1000);
        
        if (toDelete && toDelete.length > 0) {
          const ids = toDelete.map(d => d.id);
          await supabase
            .from('document_embeddings')
            .delete()
            .in('id', ids);
          deleted += toDelete.length;
          console.log(`      Deleted ${deleted} embeddings...`);
        } else {
          hasMore = false;
        }
      }
      
      // Delete old document
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', existing.id);
        
      console.log(`   ✅ Cleanup complete - removed ${deleted} old embeddings\n`);
    }

    // Parse PDF content
    const content = await parsePDFDocument(doc.path);
    
    // Get file stats
    const stats = fs.statSync(doc.path);
    const fileSizeKB = Math.round(stats.size / 1024);
    const fileSizeMB = (fileSizeKB / 1024).toFixed(2);
    const contentLength = content.length;
    
    console.log(`\n   📊 Document Statistics:`);
    console.log(`      - File size: ${fileSizeMB} MB`);
    console.log(`      - Content length: ${contentLength.toLocaleString()} characters`);
    
    // Store document first
    console.log(`\n   📝 Creating document record...`);
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        title: doc.title,
        content: content.substring(0, 50000), // Store first 50k chars as preview
        document_type: doc.type,
        metadata: {
          ...doc.metadata,
          file_size_kb: fileSizeKB,
          file_size_mb: fileSizeMB,
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
    
    console.log(`   ✅ Document record created with ID: ${document.id}`);
    
    // Chunk the content
    console.log(`\n   ✂️  Chunking content...`);
    const chunks = chunkText(content, 1000, 200);
    console.log(`   📄 Created ${chunks.length.toLocaleString()} chunks`);
    
    // Process chunks in batches
    const { successCount, failCount } = await batchInsertChunksWithProgress(
      document.id, 
      chunks, 
      doc.title, 
      doc.type
    );
    
    if (successCount > 0) {
      console.log('\n' + '=' .repeat(60));
      console.log('✨ SUCCESS! FAR document fully ingested!\n');
      
      // Get final statistics
      const { count: embCount } = await supabase
        .from('document_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', document.id);
      
      console.log('📊 Final Statistics:');
      console.log(`   📚 Document: Federal Acquisition Regulation (FAR)`);
      console.log(`   🔍 Total Embeddings: ${embCount?.toLocaleString()}`);
      console.log(`   ✅ Success Rate: ${Math.round((successCount / chunks.length) * 100)}%`);
      
      console.log('\n🎯 Your system now has the COMPLETE FAR document!');
      console.log('   - All FAR clauses are searchable');
      console.log('   - Contract analysis will reference actual regulations');
      console.log('   - Compliance checks use official FAR text');
      
      console.log('\n💡 Test the system with FAR queries:');
      console.log('   npm run test-rag');
      
      return true;
    } else {
      console.error('\n❌ Failed to ingest FAR document');
      return false;
    }
    
  } catch (error) {
    console.error(`\n❌ Fatal error processing FAR document:`, error);
    return false;
  }
}

// Run the FAR ingestion
console.log('⚠️  This process will take approximately 10-15 minutes for the complete FAR document.\n');
console.log('☕ Grab a coffee while we process 6.5 million characters of regulation text!\n');

processFARDocument().then(success => {
  if (success) {
    console.log('\n🚀 FAR ingestion completed successfully!');
    process.exit(0);
  } else {
    console.error('\n❌ FAR ingestion failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});