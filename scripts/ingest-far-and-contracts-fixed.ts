#!/usr/bin/env tsx

/**
 * FIXED ingestion script for FAR Matrix and Contract T&Cs Matrix
 * This version correctly extracts FAR clause numbers and Auburn policies
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// File paths
const FAR_MATRIX_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/2023-03-20_FAR Matrix.xls';
const CONTRACT_TERMS_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/Contract Ts&Cs Matrix.xlsm';

interface ProcessedChunk {
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
  far_section?: string;
  term_type?: string;
  risk_level?: string;
  is_auburn_approved?: boolean;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const maxChars = 30000;
    const truncatedText = text.length > maxChars 
      ? text.substring(0, maxChars) + '...' 
      : text;
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding for text of length:', text.length);
    throw error;
  }
}

/**
 * Process FAR Matrix Excel file with CORRECT column mapping
 */
async function processFARMatrix(): Promise<ProcessedChunk[]> {
  console.log('📊 Processing FAR Matrix file with correct mapping...');
  
  const workbook = XLSX.readFile(FAR_MATRIX_PATH);
  const chunks: ProcessedChunk[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`  Processing sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    
    if (data.length < 2) continue; // Need at least header and one data row
    
    // Skip the KEY row and get actual headers
    const headers = data[0] as string[];
    const rows = data.slice(2); // Skip header and KEY row
    
    // FAR Matrix specific column indices
    const clauseCol = 0; // "Clause " column
    const titleCol = 1;  // "Title" column
    const dateCol = 2;   // "Clause Date" column
    const acceptanceCol = 3; // "Acceptance Status*" column
    const criteriaCol = 4; // "Acceptance Criteria or Additional Notes" column
    const requestCol = 5; // "Request to Sponsor" column
    
    let processedCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const clauseNumber = row[clauseCol]?.toString().trim();
      const title = row[titleCol]?.toString().trim();
      const acceptanceStatus = row[acceptanceCol]?.toString().trim();
      const acceptanceCriteria = row[criteriaCol]?.toString().trim();
      const requestToSponsor = row[requestCol]?.toString().trim();
      
      // Skip rows that don't have valid FAR clause numbers
      if (!clauseNumber || clauseNumber === 'OLD' || !clauseNumber.match(/^\d+\.\d+/)) {
        continue;
      }
      
      // Determine risk level based on acceptance status
      let riskLevel = 'Standard';
      if (acceptanceStatus === 'Remove' || acceptanceStatus?.toLowerCase().includes('never')) {
        riskLevel = 'CRITICAL';
      } else if (acceptanceStatus === 'C') {
        riskLevel = 'HIGH';
      } else if (acceptanceStatus === 'OK') {
        riskLevel = 'LOW';
      }
      
      // Create a comprehensive chunk for this FAR clause
      const chunkText = `FAR Clause ${clauseNumber} - ${title || 'Untitled'}
Acceptance Status: ${acceptanceStatus || 'Not specified'}
Auburn Policy: ${acceptanceCriteria || 'No specific Auburn policy'}
Request to Sponsor: ${requestToSponsor || 'None'}
Risk Level: ${riskLevel}

This FAR clause ${acceptanceStatus === 'OK' ? 'is always acceptable' : 
                   acceptanceStatus === 'Remove' ? 'must never be accepted by Auburn' :
                   acceptanceStatus === 'C' ? 'is conditionally acceptable based on the criteria' :
                   'requires review'}.

${acceptanceCriteria ? `Auburn's position: ${acceptanceCriteria}` : ''}
${requestToSponsor ? `\nNegotiation guidance: ${requestToSponsor}` : ''}`;
      
      chunks.push({
        text: chunkText,
        metadata: {
          document_type: 'far_matrix',
          document_title: 'FAR Matrix - Federal Acquisition Regulations',
          sheet_name: sheetName,
          clause_number: clauseNumber,
          clause_title: title,
          acceptance_status: acceptanceStatus,
          source_file: '2023-03-20_FAR Matrix.xls',
          ingestion_date: new Date().toISOString(),
        },
        far_section: clauseNumber, // Store the actual FAR clause number
        risk_level: riskLevel,
      });
      
      processedCount++;
    }
    
    console.log(`    ✅ Processed ${processedCount} FAR clauses from ${sheetName}`);
  }
  
  console.log(`  ✅ Total: ${chunks.length} FAR Matrix chunks`);
  
  // For testing, limit to first 100 chunks
  const limitedChunks = chunks.slice(0, 100);
  console.log(`  📌 Limiting to ${limitedChunks.length} chunks for testing`);
  return limitedChunks;
}

/**
 * Process Contract Terms & Conditions Matrix with better structure
 */
async function processContractTerms(): Promise<ProcessedChunk[]> {
  console.log('📄 Processing Contract Terms Matrix with improved parsing...');
  
  const workbook = XLSX.readFile(CONTRACT_TERMS_PATH);
  const chunks: ProcessedChunk[] = [];
  
  // Skip INDEX sheet, process specific term sheets
  const termSheets = workbook.SheetNames.filter(name => 
    name !== 'INDEX' && name !== 'CONTACTS'
  );
  
  for (const sheetName of termSheets) {
    console.log(`  Processing term sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    
    if (data.length < 2) continue;
    
    // Contract Terms sheets have a different structure
    // They typically have sections like "Auburn's Preferred Language", "Common Problems", etc.
    let currentSection = '';
    let processedCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Check if this is a section header
      const firstCell = row[0]?.toString().trim();
      const secondCell = row[1]?.toString().trim();
      
      if (secondCell && !firstCell) {
        // This might be a section header (e.g., "Auburn's Preferred Language")
        if (secondCell.toLowerCase().includes('auburn') || 
            secondCell.toLowerCase().includes('common') ||
            secondCell.toLowerCase().includes('alternative')) {
          currentSection = secondCell;
          continue;
        }
      }
      
      // Process content rows
      if (secondCell && secondCell.length > 50) { // Likely contract language
        const isAuburnApproved = currentSection.toLowerCase().includes('auburn');
        const languageType = isAuburnApproved ? 'alternative' : 'standard';
        
        // Determine risk level based on context
        let riskLevel = 'Standard';
        if (secondCell.toLowerCase().includes('never') || 
            secondCell.toLowerCase().includes('prohibited')) {
          riskLevel = 'CRITICAL';
        } else if (secondCell.toLowerCase().includes('must') || 
                   secondCell.toLowerCase().includes('required')) {
          riskLevel = 'HIGH';
        }
        
        const chunkText = `Contract Terms - ${sheetName}
Section: ${currentSection || 'General'}
Language Type: ${languageType}
Auburn Approved: ${isAuburnApproved ? 'Yes' : 'No'}
Risk Level: ${riskLevel}

Contract Language:
${secondCell}

${isAuburnApproved ? 'This is Auburn University\'s preferred language for this contract term.' : 
  'This is standard contract language that may need modification for Auburn compliance.'}`;
        
        chunks.push({
          text: chunkText,
          metadata: {
            document_type: 'contract_template',
            document_title: 'Contract Terms & Conditions Matrix - Auburn Standards',
            sheet_name: sheetName,
            section: currentSection,
            language_type: languageType,
            source_file: 'Contract Ts&Cs Matrix.xlsm',
            ingestion_date: new Date().toISOString(),
          },
          term_type: sheetName,
          risk_level: riskLevel,
          is_auburn_approved: isAuburnApproved,
        });
        
        processedCount++;
        
        // Also look for additional columns with responses/alternatives
        for (let j = 2; j < row.length; j++) {
          const additionalText = row[j]?.toString().trim();
          if (additionalText && additionalText.length > 20) {
            const responseChunkText = `Contract Terms - ${sheetName} - Response Option ${j-1}
Section: ${currentSection || 'General'}
Context: Alternative response or negotiation position

Response:
${additionalText}

This is a suggested response or alternative position for negotiating ${sheetName} terms with sponsors.`;
            
            chunks.push({
              text: responseChunkText,
              metadata: {
                document_type: 'contract_template',
                document_title: 'Contract Terms & Conditions Matrix - Auburn Standards',
                sheet_name: sheetName,
                section: currentSection,
                response_number: j - 1,
                source_file: 'Contract Ts&Cs Matrix.xlsm',
                ingestion_date: new Date().toISOString(),
              },
              term_type: sheetName,
              risk_level: 'Standard',
              is_auburn_approved: true,
            });
            
            processedCount++;
          }
        }
      }
    }
    
    console.log(`    ✅ Processed ${processedCount} terms from ${sheetName}`);
  }
  
  console.log(`  ✅ Total: ${chunks.length} Contract Terms chunks`);
  
  // For testing, limit to first 50 chunks
  const limitedChunks = chunks.slice(0, 50);
  console.log(`  📌 Limiting to ${limitedChunks.length} chunks for testing`);
  return limitedChunks;
}

/**
 * Store chunks in Supabase with proper fields
 */
async function storeChunks(chunks: ProcessedChunk[], documentTitle: string): Promise<string> {
  console.log(`💾 Storing ${chunks.length} chunks in Supabase...`);
  
  // Create document record with summary content only (full content would be too large)
  const documentId = uuidv4();
  const summaryContent = `${documentTitle} containing ${chunks.length} chunks. ` +
    `Document types: ${[...new Set(chunks.map(c => c.metadata.document_type))].join(', ')}. ` +
    `This document contains reference material for contract compliance checking.`;
  
  const { error: docError } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      title: documentTitle,
      content: summaryContent,
      document_type: chunks[0]?.metadata.document_type || 'unknown',
      source_file: chunks[0]?.metadata.source_file || '',
      metadata: {
        total_chunks: chunks.length,
        ingestion_date: new Date().toISOString(),
      }
    });
  
  if (docError) {
    console.error('Error creating document:', docError);
  } else {
    console.log(`  Document created with ID: ${documentId}`);
  }
  
  // Process chunks in batches
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`  Generating embeddings for batch ${Math.floor(i/batchSize) + 1}...`);
    
    // Generate embeddings for batch
    const embeddingsPromises = batch.map(chunk => generateEmbedding(chunk.text));
    const embeddings = await Promise.all(embeddingsPromises);
    
    // Prepare records for insertion
    const records = batch.map((chunk, idx) => ({
      id: uuidv4(),
      document_id: documentId,
      chunk_text: chunk.text,
      chunk_index: i + idx,
      embedding: embeddings[idx],
      metadata: {
        ...chunk.metadata,
        document_title: documentTitle,
      },
      far_section: chunk.far_section || null,
      term_type: chunk.term_type || null,
      risk_level: chunk.risk_level || null,
      is_auburn_approved: chunk.is_auburn_approved || false,
    }));
    
    // Insert batch
    const { error } = await supabase
      .from('document_embeddings')
      .insert(records);
    
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
    } else {
      console.log(`  ✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${records.length} embeddings)`);
    }
  }
  
  console.log(`✅ Successfully stored ${chunks.length} embeddings`);
  return documentId;
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 Starting FIXED FAR Matrix and Contract Terms ingestion...\n');
  
  try {
    // Clear existing data first
    console.log('🗑️  Clearing existing FAR and Contract Terms data...');
    const { error: deleteError } = await supabase
      .from('document_embeddings')
      .delete()
      .or('far_section.not.is.null,term_type.not.is.null');
    
    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
    }
    
    console.log('═══════════════════════════════════════');
    console.log('Processing FAR Matrix...');
    console.log('═══════════════════════════════════════');
    const farChunks = await processFARMatrix();
    const farDocId = await storeChunks(farChunks, 'FAR Matrix - Federal Acquisition Regulations');
    
    console.log('\n═══════════════════════════════════════');
    console.log('Processing Contract Terms Matrix...');
    console.log('═══════════════════════════════════════');
    const contractChunks = await processContractTerms();
    const contractDocId = await storeChunks(contractChunks, 'Contract Terms & Conditions Matrix - Auburn Standards');
    
    console.log('\n🎉 Ingestion complete!');
    console.log('═══════════════════════════════════════');
    console.log(`FAR Matrix Document ID: ${farDocId}`);
    console.log(`Contract Terms Document ID: ${contractDocId}`);
    console.log(`Total chunks processed: ${farChunks.length + contractChunks.length}`);
    console.log('═══════════════════════════════════════\n');
    
    // Test retrieval
    console.log('🔍 Testing retrieval...');
    const { data: testData } = await supabase
      .from('document_embeddings')
      .select('far_section, term_type, risk_level')
      .or('far_section.not.is.null,term_type.not.is.null')
      .limit(10);
    
    console.log('Sample ingested data:');
    console.log(JSON.stringify(testData, null, 2));
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    process.exit(1);
  }
}

// Run the ingestion
main();