import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with lazy initialization
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Chunks text into smaller segments for embedding
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    
    // Avoid infinite loop for very small texts
    if (start >= text.length - overlap) break;
  }
  
  return chunks;
}

/**
 * Generates embeddings using OpenAI's text-embedding-3-small model
 * Cost: ~$0.02 per million tokens (one-time cost)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  // If no API key, use mock embeddings
  if (!OPENAI_API_KEY) {
    console.warn('No OpenAI API key found, using mock embeddings');
    // Generate consistent mock embedding based on text
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    return new Array(1536).fill(0).map(() => random() * 2 - 1);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit to avoid token limits
        encoding_format: 'float'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', response.status, error);
      // Fall back to mock embeddings
      const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = () => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      return new Array(1536).fill(0).map(() => random() * 2 - 1);
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      console.error('Invalid OpenAI response format');
      throw new Error('Invalid embedding response');
    }
    
    // Return the embedding vector (1536 dimensions for text-embedding-3-small)
    return data.data[0].embedding;
    
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    // Fall back to mock embeddings
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    return new Array(1536).fill(0).map(() => random() * 2 - 1);
  }
}

/**
 * Ingests a document into the knowledge base
 */
export async function ingestDocument(
  title: string,
  content: string,
  documentType: string,
  metadata: any = {}
) {
  try {
    console.log(`📥 Ingesting document: ${title}`);
    
    // 1. Store the document
    const { data: document, error: docError } = await getSupabaseClient()
      .from('knowledge_documents')
      .insert({
        title,
        content,
        document_type: documentType,
        metadata
      })
      .select()
      .single();
    
    if (docError) {
      console.error('Error storing document:', docError);
      throw docError;
    }
    
    console.log(`✅ Document stored with ID: ${document.id}`);
    
    // 2. Chunk the content
    const chunks = chunkText(content, 1000, 200);
    console.log(`📄 Created ${chunks.length} chunks`);
    
    // 3. Generate embeddings and store them
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      
      const { error: embError } = await getSupabaseClient()
        .from('document_embeddings')
        .insert({
          document_id: document.id,
          chunk_text: chunks[i],
          chunk_index: i,
          embedding,
          metadata: {
            title,
            document_type: documentType,
            chunk_number: i + 1,
            total_chunks: chunks.length
          }
        });
      
      if (embError) {
        console.error(`Error storing embedding for chunk ${i}:`, embError);
      } else {
        console.log(`✅ Stored embedding for chunk ${i + 1}/${chunks.length}`);
      }
    }
    
    console.log(`✅ Successfully ingested document: ${title}`);
    return document.id;
    
  } catch (error) {
    console.error('Error ingesting document:', error);
    throw error;
  }
}

/**
 * Ingests multiple documents in batch
 */
export async function ingestDocuments(
  documents: Array<{
    title: string;
    content: string;
    type: string;
    metadata?: any;
  }>
) {
  const results = [];
  
  for (const doc of documents) {
    try {
      const id = await ingestDocument(
        doc.title,
        doc.content,
        doc.type,
        doc.metadata
      );
      results.push({ success: true, id, title: doc.title });
    } catch (error) {
      results.push({ success: false, title: doc.title, error });
    }
  }
  
  return results;
}

/**
 * Seeds the initial Auburn policies and FAR matrix
 * Note: This function is deprecated - documents are now ingested directly from PDFs
 */
export async function seedKnowledgeBase() {
  try {
    console.log('🌱 Starting knowledge base seeding...');
    
    // Check if already seeded
    const { data: existing } = await getSupabaseClient()
      .from('knowledge_documents')
      .select('id')
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log('⚠️ Knowledge base already contains documents. Skipping seed.');
      return { message: 'Knowledge base already seeded with real documents' };
    }
    
    console.log('ℹ️ No seed data needed - use ingest scripts to add real documents');
    console.log('   Run: npm run ingest-documents');
    
    return { 
      message: 'Please use the document ingestion scripts to add real FAR and Auburn documents',
      command: 'npm run ingest-documents'
    };
    
  } catch (error) {
    console.error('❌ Error in seedKnowledgeBase:', error);
    throw error;
  }
}