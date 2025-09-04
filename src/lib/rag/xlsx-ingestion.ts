// XLSX Document Ingestion for Auburn Contract Review System
import { createClient } from '@supabase/supabase-js';
import { parseXLSXFile, AuburnXLSXProcessor, EmbeddingChunk } from '@/lib/documents/xlsx-parser';
import { generateEmbedding } from './document-ingestion';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function ingestXLSXDocument(
  title: string,
  filePath: string | ArrayBuffer,
  documentType: string = 'policy_matrix',
  metadata: any = {}
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const processor = new AuburnXLSXProcessor();
  
  try {
    console.log(`📊 Starting XLSX ingestion for: ${title}`);
    
    // Parse XLSX file
    const parsedData = await parseXLSXFile(filePath, {
      preserveStructure: true,
      includeHeaders: true
    });
    
    console.log(`📋 Found ${parsedData.sheets.length} sheets`);
    
    // Create document record
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        id: uuidv4(),
        title,
        content: parsedData.sheets.map(s => s.semanticContent).join('\n\n'),
        document_type: documentType,
        source_url: metadata.source_url || null,
        metadata: {
          ...metadata,
          file_type: 'xlsx',
          sheet_count: parsedData.sheets.length,
          total_rows: parsedData.workbookMetadata.totalRows,
          ingestion_date: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (docError) {
      console.error('Error creating document:', docError);
      throw docError;
    }
    
    console.log(`✅ Document created with ID: ${document.id}`);
    
    // Process each sheet
    const allChunks: Array<{
      id: string;
      document_id: string;
      chunk_text: string;
      chunk_index: number;
      embedding?: number[];
      metadata: any;
    }> = [];
    
    let globalChunkIndex = 0;
    
    for (const sheet of parsedData.sheets) {
      console.log(`🔍 Processing sheet: ${sheet.name}`);
      
      // Auto-detect sheet type and process accordingly
      const chunks = processor.autoProcessSheet(
        sheet.name,
        sheet.data,
        sheet.headers
      );
      
      console.log(`📝 Generated ${chunks.length} chunks from ${sheet.name}`);
      
      // Generate embeddings for each chunk
      for (const chunk of chunks) {
        try {
          const embedding = await generateEmbedding(chunk.text);
          
          allChunks.push({
            id: uuidv4(),
            document_id: document.id,
            chunk_text: chunk.text,
            chunk_index: globalChunkIndex++,
            embedding,
            metadata: {
              ...chunk.metadata,
              sheet_name: sheet.name,
              document_title: title,
              document_type: documentType
            }
          });
        } catch (embError) {
          console.error(`Error generating embedding for chunk ${globalChunkIndex}:`, embError);
          // Continue with next chunk
        }
      }
    }
    
    // Batch insert embeddings
    if (allChunks.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        
        const { error: embedError } = await supabase
          .from('document_embeddings')
          .insert(batch);
        
        if (embedError) {
          console.error(`Error inserting embeddings batch ${i / batchSize}:`, embedError);
        } else {
          console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} embeddings)`);
        }
      }
    }
    
    console.log(`🎉 Successfully ingested XLSX document: ${title}`);
    console.log(`📊 Total chunks created: ${allChunks.length}`);
    
    return {
      success: true,
      documentId: document.id,
      chunksCreated: allChunks.length,
      sheets: parsedData.sheets.map(s => s.name)
    };
    
  } catch (error) {
    console.error('❌ Error ingesting XLSX document:', error);
    throw error;
  }
}

// Function to update existing documents with XLSX data
export async function updateDocumentWithXLSX(
  documentId: string,
  xlsxFilePath: string | ArrayBuffer,
  options: {
    replaceExisting?: boolean;
    mergeMetadata?: boolean;
  } = {}
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  if (options.replaceExisting) {
    // Delete existing embeddings
    const { error: deleteError } = await supabase
      .from('document_embeddings')
      .delete()
      .eq('document_id', documentId);
    
    if (deleteError) {
      console.error('Error deleting existing embeddings:', deleteError);
    }
  }
  
  // Continue with ingestion...
  // Implementation similar to ingestXLSXDocument but updating existing document
}

// Batch ingest multiple XLSX files
export async function batchIngestXLSXDocuments(
  documents: Array<{
    title: string;
    filePath: string | ArrayBuffer;
    documentType: string;
    metadata?: any;
  }>
) {
  const results = [];
  
  for (const doc of documents) {
    try {
      const result = await ingestXLSXDocument(
        doc.title,
        doc.filePath,
        doc.documentType,
        doc.metadata
      );
      results.push({ ...doc, ...result });
    } catch (error) {
      console.error(`Failed to ingest ${doc.title}:`, error);
      results.push({ ...doc, success: false, error });
    }
  }
  
  return results;
}

// Helper to extract Auburn-specific metadata from XLSX
export function extractAuburnMetadata(chunks: EmbeddingChunk[]): {
  farSections: string[];
  policyReferences: string[];
  riskLevels: string[];
  hasAlternatives: number;
} {
  const farSections = new Set<string>();
  const policyReferences = new Set<string>();
  const riskLevels = new Set<string>();
  let hasAlternatives = 0;
  
  chunks.forEach(chunk => {
    if (chunk.metadata.far_section) {
      farSections.add(chunk.metadata.far_section);
    }
    if (chunk.metadata.policy_reference) {
      policyReferences.add(chunk.metadata.policy_reference);
    }
    if (chunk.metadata.risk_level) {
      riskLevels.add(chunk.metadata.risk_level);
    }
    if (chunk.metadata.has_alternative) {
      hasAlternatives++;
    }
  });
  
  return {
    farSections: Array.from(farSections),
    policyReferences: Array.from(policyReferences),
    riskLevels: Array.from(riskLevels),
    hasAlternatives
  };
}