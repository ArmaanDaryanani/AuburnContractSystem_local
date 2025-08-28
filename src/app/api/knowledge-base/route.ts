import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

export const runtime = 'edge'; // Force edge runtime
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET() {
  try {
    console.log('[/api/knowledge-base] Starting GET request');
    
    // Always return mock data for now
    const shouldUseMock = true;
    
    if (shouldUseMock || !process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SERVICE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      console.log('[/api/knowledge-base] Returning mock data');
      // Return mock data when Supabase is not configured
      return NextResponse.json({
        documents: [
          {
            id: 'mock-1',
            title: 'FAR Clauses Matrix',
            type: 'far_matrix',
            status: 'indexed',
            chunks: 150,
            embeddingCount: 150,
            characterCount: 45000,
            createdAt: new Date().toISOString()
          },
          {
            id: 'mock-2',
            title: 'Auburn Procurement Policies',
            type: 'auburn_policy',
            status: 'indexed',
            chunks: 75,
            embeddingCount: 75,
            characterCount: 22500,
            createdAt: new Date().toISOString()
          },
          {
            id: 'mock-3',
            title: 'Standard Contract Template',
            type: 'contract_template',
            status: 'indexed',
            chunks: 50,
            embeddingCount: 50,
            characterCount: 15000,
            createdAt: new Date().toISOString()
          }
        ],
        statistics: {
          totalDocuments: 3,
          totalChunks: 275,
          totalEmbeddings: 275,
          totalCharacters: 82500,
          documentTypes: {
            far_matrix: 1,
            auburn_policy: 1,
            contract_template: 1
          },
          indexingStatus: {
            indexed: 3,
            pending: 0
          }
        },
        lastUpdated: new Date().toISOString()
      });
    }
    
    const supabase = getSupabaseClient();
    
    // Get all documents from knowledge base
    const { data: documents, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (docError) throw docError;
    
    // Get embedding counts for each document
    const documentStats = await Promise.all(
      (documents || []).map(async (doc) => {
        const { count } = await supabase
          .from('document_embeddings')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id);
        
        return {
          ...doc,
          embeddingCount: count || 0
        };
      })
    );
    
    // Format documents with metadata
    const formattedDocs = documentStats.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.document_type,
      chunks: doc.embeddingCount,
      size: doc.metadata?.file_size_mb ? `${doc.metadata.file_size_mb} MB` : 'Unknown',
      uploadedAt: doc.created_at,
      status: doc.embeddingCount > 0 ? 'indexed' : 'pending',
      characterCount: doc.metadata?.character_count || doc.content?.length || 0
    }));
    
    // Calculate statistics
    const stats = {
      totalDocuments: documents?.length || 0,
      totalChunks: formattedDocs.reduce((sum, doc) => sum + doc.chunks, 0),
      documentTypes: {
        far_matrix: formattedDocs.filter(d => d.type === 'far_matrix').length,
        auburn_policy: formattedDocs.filter(d => d.type === 'auburn_policy').length,
        contract_template: formattedDocs.filter(d => d.type === 'contract_template').length,
        approved_alternative: formattedDocs.filter(d => d.type === 'approved_alternative').length
      },
      indexingStatus: {
        indexed: formattedDocs.filter(d => d.status === 'indexed').length,
        pending: formattedDocs.filter(d => d.status === 'pending').length
      }
    };
    
    return NextResponse.json({
      documents: formattedDocs,
      statistics: stats,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to fetch knowledge base',
      details: errorMessage,
      envCheck: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, documentId } = body;
    const supabase = getSupabaseClient();
    
    if (action === 'reindex' && documentId) {
      // Trigger reindexing for a specific document
      // This would regenerate embeddings for the document
      return NextResponse.json({ 
        success: true, 
        message: 'Document reindexing initiated',
        documentId 
      });
    }
    
    if (action === 'delete' && documentId) {
      // Delete document and its embeddings
      const { error: embError } = await supabase
        .from('document_embeddings')
        .delete()
        .eq('document_id', documentId);
      
      if (!embError) {
        const { error: docError } = await supabase
          .from('knowledge_documents')
          .delete()
          .eq('id', documentId);
        
        if (!docError) {
          return NextResponse.json({ 
            success: true, 
            message: 'Document deleted successfully' 
          });
        }
      }
      
      throw new Error('Failed to delete document');
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('Error in knowledge base action:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}