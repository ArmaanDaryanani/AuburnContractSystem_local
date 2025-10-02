#!/usr/bin/env tsx

/**
 * Comprehensive ingestion script for FAR Matrix and Contract T&Cs Matrix
 * This script processes both Excel files and ingests them into Supabase with optimized chunking
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
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY!
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
}

interface FARMatrixRow {
  farSection?: string;
  requirement?: string;
  auburnPolicy?: string;
  complianceNotes?: string;
  riskLevel?: string;
  category?: string;
}

interface ContractTermsRow {
  termType?: string;
  standardLanguage?: string;
  alternativeLanguage?: string;
  riskLevel?: string;
  category?: string;
  auburnRequirement?: string;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Truncate text if it's too long (OpenAI has a token limit)
    // text-embedding-3-small has a limit of 8192 tokens (~32,000 chars)
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
 * Process FAR Matrix Excel file
 */
async function processFARMatrix(): Promise<ProcessedChunk[]> {
  console.log('📊 Processing FAR Matrix file...');
  
  const workbook = XLSX.readFile(FAR_MATRIX_PATH);
  const chunks: ProcessedChunk[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`  Processing sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    
    if (data.length === 0) continue;
    
    // Extract headers
    const headers = data[0] as string[];
    const rows = data.slice(1);
    
    // Find column indices
    const colIndices = {
      farSection: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('far') || 
        h?.toString().toLowerCase().includes('section')
      ),
      requirement: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('requirement') || 
        h?.toString().toLowerCase().includes('description')
      ),
      auburnPolicy: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('auburn') || 
        h?.toString().toLowerCase().includes('policy')
      ),
      complianceNotes: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('note') || 
        h?.toString().toLowerCase().includes('compliance')
      ),
      riskLevel: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('risk') || 
        h?.toString().toLowerCase().includes('level')
      ),
      category: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('category') || 
        h?.toString().toLowerCase().includes('type')
      ),
    };
    
    // Group related FAR sections for semantic chunking
    let currentSection = '';
    let sectionChunks: any[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const farData: FARMatrixRow = {
        farSection: colIndices.farSection >= 0 ? row[colIndices.farSection] : '',
        requirement: colIndices.requirement >= 0 ? row[colIndices.requirement] : '',
        auburnPolicy: colIndices.auburnPolicy >= 0 ? row[colIndices.auburnPolicy] : '',
        complianceNotes: colIndices.complianceNotes >= 0 ? row[colIndices.complianceNotes] : '',
        riskLevel: colIndices.riskLevel >= 0 ? row[colIndices.riskLevel] : '',
        category: colIndices.category >= 0 ? row[colIndices.category] : '',
      };
      
      // Check if we're in a new FAR section
      const section = farData.farSection?.toString().split('.')[0] || '';
      
      if (section !== currentSection && sectionChunks.length > 0) {
        // Process accumulated section chunks
        const chunkText = sectionChunks.slice(0, 10).map(chunk => // Limit to 10 items per chunk
          `FAR Section ${chunk.farSection}: ${chunk.requirement}. ` +
          `Auburn Policy: ${chunk.auburnPolicy}. ` +
          `Compliance Notes: ${chunk.complianceNotes}. ` +
          `Risk Level: ${chunk.riskLevel || 'Standard'}.`
        ).join('\n\n');
        
        chunks.push({
          text: chunkText,
          metadata: {
            document_type: 'far_matrix',
            sheet_name: sheetName,
            far_section: currentSection,
            risk_levels: [...new Set(sectionChunks.map(c => c.riskLevel).filter(Boolean))],
            row_count: sectionChunks.length,
            category: sectionChunks[0]?.category || 'General',
            chunk_type: 'far_section_group',
            source_file: '2023-03-20_FAR Matrix.xls',
            ingestion_date: new Date().toISOString(),
          }
        });
        
        sectionChunks = [];
      }
      
      currentSection = section;
      sectionChunks.push(farData);
      
      // Also create individual row chunks for granular search
      if (farData.requirement) {
        const rowText = `FAR Section ${farData.farSection}: ${farData.requirement}. ` +
          `Auburn Policy: ${farData.auburnPolicy}. ` +
          `Compliance Notes: ${farData.complianceNotes}. ` +
          `Risk Level: ${farData.riskLevel || 'Standard'}.`;
        
        chunks.push({
          text: rowText,
          metadata: {
            document_type: 'far_matrix',
            sheet_name: sheetName,
            far_section: farData.farSection,
            risk_level: farData.riskLevel || 'Standard',
            category: farData.category || 'General',
            chunk_type: 'far_individual',
            row_index: i,
            has_auburn_policy: !!farData.auburnPolicy,
            source_file: '2023-03-20_FAR Matrix.xls',
            ingestion_date: new Date().toISOString(),
          }
        });
      }
    }
    
    // Process remaining chunks
    if (sectionChunks.length > 0) {
      const chunkText = sectionChunks.slice(0, 10).map(chunk => // Limit to 10 items per chunk
        `FAR Section ${chunk.farSection}: ${chunk.requirement}. ` +
        `Auburn Policy: ${chunk.auburnPolicy}. ` +
        `Compliance Notes: ${chunk.complianceNotes}. ` +
        `Risk Level: ${chunk.riskLevel || 'Standard'}.`
      ).join('\n\n');
      
      chunks.push({
        text: chunkText,
        metadata: {
          document_type: 'far_matrix',
          sheet_name: sheetName,
          far_section: currentSection,
          risk_levels: [...new Set(sectionChunks.map(c => c.riskLevel).filter(Boolean))],
          row_count: sectionChunks.length,
          category: sectionChunks[0]?.category || 'General',
          chunk_type: 'far_section_group',
          source_file: '2023-03-20_FAR Matrix.xls',
          ingestion_date: new Date().toISOString(),
        }
      });
    }
  }
  
  console.log(`  ✅ Processed ${chunks.length} FAR Matrix chunks`);
  return chunks;
}

/**
 * Process Contract Terms & Conditions Matrix
 */
async function processContractTerms(): Promise<ProcessedChunk[]> {
  console.log('📄 Processing Contract Terms Matrix file...');
  
  const workbook = XLSX.readFile(CONTRACT_TERMS_PATH);
  const chunks: ProcessedChunk[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`  Processing sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    
    if (data.length === 0) continue;
    
    // Extract headers
    const headers = data[0] as string[];
    const rows = data.slice(1);
    
    // Find column indices
    const colIndices = {
      termType: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('term') || 
        h?.toString().toLowerCase().includes('clause')
      ),
      standardLanguage: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('standard') || 
        h?.toString().toLowerCase().includes('original')
      ),
      alternativeLanguage: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('alternative') || 
        h?.toString().toLowerCase().includes('auburn')
      ),
      riskLevel: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('risk')
      ),
      category: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('category') || 
        h?.toString().toLowerCase().includes('type')
      ),
      requirement: headers.findIndex(h => 
        h?.toString().toLowerCase().includes('requirement') || 
        h?.toString().toLowerCase().includes('policy')
      ),
    };
    
    // Group by term type for semantic chunking
    const termGroups: Map<string, ContractTermsRow[]> = new Map();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const termData: ContractTermsRow = {
        termType: colIndices.termType >= 0 ? row[colIndices.termType] : '',
        standardLanguage: colIndices.standardLanguage >= 0 ? row[colIndices.standardLanguage] : '',
        alternativeLanguage: colIndices.alternativeLanguage >= 0 ? row[colIndices.alternativeLanguage] : '',
        riskLevel: colIndices.riskLevel >= 0 ? row[colIndices.riskLevel] : '',
        category: colIndices.category >= 0 ? row[colIndices.category] : '',
        auburnRequirement: colIndices.requirement >= 0 ? row[colIndices.requirement] : '',
      };
      
      // Group by term type
      const termType = termData.termType?.toString() || 'General';
      if (!termGroups.has(termType)) {
        termGroups.set(termType, []);
      }
      termGroups.get(termType)!.push(termData);
      
      // Create individual chunks for each term (for precise retrieval)
      if (termData.standardLanguage || termData.alternativeLanguage) {
        // Chunk for standard language
        if (termData.standardLanguage) {
          chunks.push({
            text: `Contract Term - ${termData.termType}: STANDARD LANGUAGE: "${termData.standardLanguage}". ` +
                  `Risk Level: ${termData.riskLevel || 'Standard'}. ` +
                  `Auburn Requirement: ${termData.auburnRequirement || 'None specified'}.`,
            metadata: {
              document_type: 'contract_terms',
              sheet_name: sheetName,
              term_type: termData.termType,
              language_type: 'standard',
              risk_level: termData.riskLevel || 'Standard',
              category: termData.category || 'General',
              chunk_type: 'contract_standard',
              row_index: i,
              has_alternative: !!termData.alternativeLanguage,
              source_file: 'Contract Ts&Cs Matrix.xlsm',
              ingestion_date: new Date().toISOString(),
            }
          });
        }
        
        // Chunk for alternative language
        if (termData.alternativeLanguage) {
          chunks.push({
            text: `Contract Term - ${termData.termType}: AUBURN ALTERNATIVE LANGUAGE: "${termData.alternativeLanguage}". ` +
                  `This is the Auburn-approved alternative to standard contract language. ` +
                  `Risk Level: ${termData.riskLevel || 'Standard'}. ` +
                  `Auburn Requirement: ${termData.auburnRequirement || 'None specified'}.`,
            metadata: {
              document_type: 'approved_alternative',
              sheet_name: sheetName,
              term_type: termData.termType,
              language_type: 'alternative',
              risk_level: termData.riskLevel || 'Standard',
              category: termData.category || 'General',
              chunk_type: 'contract_alternative',
              row_index: i,
              is_auburn_approved: true,
              source_file: 'Contract Ts&Cs Matrix.xlsm',
              ingestion_date: new Date().toISOString(),
            }
          });
        }
        
        // Create a comparison chunk if both exist
        if (termData.standardLanguage && termData.alternativeLanguage) {
          chunks.push({
            text: `Contract Term Comparison - ${termData.termType}:\n` +
                  `STANDARD: "${termData.standardLanguage}"\n` +
                  `AUBURN ALTERNATIVE: "${termData.alternativeLanguage}"\n` +
                  `Risk Level: ${termData.riskLevel || 'Standard'}. ` +
                  `Auburn Requirement: ${termData.auburnRequirement || 'None specified'}.`,
            metadata: {
              document_type: 'term_comparison',
              sheet_name: sheetName,
              term_type: termData.termType,
              language_type: 'comparison',
              risk_level: termData.riskLevel || 'Standard',
              category: termData.category || 'General',
              chunk_type: 'contract_comparison',
              row_index: i,
              source_file: 'Contract Ts&Cs Matrix.xlsm',
              ingestion_date: new Date().toISOString(),
            }
          });
        }
      }
    }
    
    // Create grouped chunks by term type
    for (const [termType, terms] of termGroups.entries()) {
      if (terms.length > 0) {
        const groupText = terms.map(term => {
          let text = `${termType} Term:\n`;
          if (term.standardLanguage) {
            text += `Standard: "${term.standardLanguage}"\n`;
          }
          if (term.alternativeLanguage) {
            text += `Auburn Alternative: "${term.alternativeLanguage}"\n`;
          }
          text += `Risk Level: ${term.riskLevel || 'Standard'}\n`;
          return text;
        }).join('\n---\n');
        
        chunks.push({
          text: `Contract Terms Group - ${termType}:\n${groupText}`,
          metadata: {
            document_type: 'contract_template', // Use valid document type
            sheet_name: sheetName,
            term_type: termType,
            term_count: terms.length,
            risk_levels: [...new Set(terms.map(t => t.riskLevel).filter(Boolean))],
            chunk_type: 'term_group',
            source_file: 'Contract Ts&Cs Matrix.xlsm',
            ingestion_date: new Date().toISOString(),
          }
        });
      }
    }
  }
  
  console.log(`  ✅ Processed ${chunks.length} Contract Terms chunks`);
  return chunks;
}

/**
 * Store chunks in Supabase with embeddings
 */
async function storeChunksInSupabase(chunks: ProcessedChunk[], documentTitle: string) {
  console.log(`💾 Storing ${chunks.length} chunks in Supabase...`);
  
  // Create main document record
  const { data: document, error: docError } = await supabase
    .from('knowledge_documents')
    .insert({
      id: uuidv4(),
      title: documentTitle,
      content: chunks.map(c => c.text).join('\n\n').substring(0, 50000), // Limit content size
      document_type: chunks[0]?.metadata.document_type === 'contract_terms' || 
                     chunks[0]?.metadata.document_type === 'approved_alternative' ||
                     chunks[0]?.metadata.document_type === 'term_comparison' 
                     ? 'contract_template' 
                     : 'far_matrix',
      metadata: {
        chunk_count: chunks.length,
        source_file: chunks[0]?.metadata.source_file,
        ingestion_date: new Date().toISOString(),
        document_types: [...new Set(chunks.map(c => c.metadata.document_type))],
      },
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (docError) {
    console.error('Error creating document:', docError);
    throw docError;
  }
  
  console.log(`  Document created with ID: ${document.id}`);
  
  // Generate embeddings and prepare for batch insert
  const embeddingChunks = [];
  const batchSize = 10;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
    
    console.log(`  Generating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);
    
    for (const chunk of batch) {
      try {
        const embedding = await generateEmbedding(chunk.text);
        
        embeddingChunks.push({
          id: uuidv4(),
          document_id: document.id,
          chunk_text: chunk.text,
          chunk_index: embeddingChunks.length,
          embedding,
          metadata: {
            ...chunk.metadata,
            document_title: documentTitle,
          },
          // Add specialized columns
          far_section: chunk.metadata.far_section || null,
          term_type: chunk.metadata.term_type || null,
          risk_level: chunk.metadata.risk_level || null,
          language_type: chunk.metadata.language_type || null,
          is_auburn_approved: chunk.metadata.is_auburn_approved || false,
          has_auburn_alternative: chunk.metadata.has_alternative || false,
          created_at: new Date().toISOString()
        } as any);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  Error generating embedding for chunk:`, error);
      }
    }
  }
  
  // Insert embeddings in batches
  const insertBatchSize = 50;
  for (let i = 0; i < embeddingChunks.length; i += insertBatchSize) {
    const batch = embeddingChunks.slice(i, Math.min(i + insertBatchSize, embeddingChunks.length));
    
    const { error: embedError } = await supabase
      .from('document_embeddings')
      .insert(batch);
    
    if (embedError) {
      console.error(`  Error inserting embeddings batch:`, embedError);
    } else {
      console.log(`  ✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1} (${batch.length} embeddings)`);
    }
  }
  
  console.log(`✅ Successfully stored ${embeddingChunks.length} embeddings`);
  return document.id;
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 Starting FAR Matrix and Contract Terms ingestion...\n');
  
  try {
    // Check if files exist
    if (!fs.existsSync(FAR_MATRIX_PATH)) {
      throw new Error(`FAR Matrix file not found at: ${FAR_MATRIX_PATH}`);
    }
    if (!fs.existsSync(CONTRACT_TERMS_PATH)) {
      throw new Error(`Contract Terms file not found at: ${CONTRACT_TERMS_PATH}`);
    }
    
    // Process FAR Matrix
    console.log('═══════════════════════════════════════');
    console.log('Processing FAR Matrix...');
    console.log('═══════════════════════════════════════');
    const farChunks = await processFARMatrix();
    const farDocId = await storeChunksInSupabase(farChunks, 'FAR Matrix - Federal Acquisition Regulations');
    
    console.log('\n═══════════════════════════════════════');
    console.log('Processing Contract Terms Matrix...');
    console.log('═══════════════════════════════════════');
    const contractChunks = await processContractTerms();
    const contractDocId = await storeChunksInSupabase(contractChunks, 'Contract Terms & Conditions Matrix - Auburn Standards');
    
    console.log('\n🎉 Ingestion complete!');
    console.log('═══════════════════════════════════════');
    console.log(`FAR Matrix Document ID: ${farDocId}`);
    console.log(`Contract Terms Document ID: ${contractDocId}`);
    console.log(`Total chunks processed: ${farChunks.length + contractChunks.length}`);
    console.log('═══════════════════════════════════════');
    
    // Test retrieval
    console.log('\n🔍 Testing retrieval...');
    const { data: testData } = await supabase
      .from('document_embeddings')
      .select('chunk_text, metadata')
      .limit(5);
    
    if (testData && testData.length > 0) {
      console.log(`✅ Successfully retrieved ${testData.length} test embeddings`);
    }
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    process.exit(1);
  }
}

// Run the script
main();