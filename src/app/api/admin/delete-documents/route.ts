import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { documentIds, deleteAll } = await request.json();
    
    if (deleteAll) {
      console.log('🗑️ Deleting ALL documents and embeddings...');
      
      // First delete all embeddings
      const { error: embedError } = await supabase
        .from('document_embeddings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (embedError) {
        console.error('Error deleting embeddings:', embedError);
        throw embedError;
      }
      
      // Then delete all documents
      const { error: docError } = await supabase
        .from('knowledge_documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (docError) {
        console.error('Error deleting documents:', docError);
        throw docError;
      }
      
      return NextResponse.json({
        message: 'All documents and embeddings deleted successfully',
        deleted: 'all'
      });
      
    } else if (documentIds && documentIds.length > 0) {
      console.log(`🗑️ Deleting ${documentIds.length} documents...`);
      
      // First delete embeddings for these documents
      const { error: embedError } = await supabase
        .from('document_embeddings')
        .delete()
        .in('document_id', documentIds);
      
      if (embedError) {
        console.error('Error deleting embeddings:', embedError);
        throw embedError;
      }
      
      // Then delete the documents
      const { error: docError } = await supabase
        .from('knowledge_documents')
        .delete()
        .in('id', documentIds);
      
      if (docError) {
        console.error('Error deleting documents:', docError);
        throw docError;
      }
      
      return NextResponse.json({
        message: `Deleted ${documentIds.length} documents successfully`,
        deleted: documentIds
      });
    } else {
      return NextResponse.json(
        { error: 'No document IDs provided' },
        { status: 400 }
      );
    }
    
  } catch (error: any) {
    console.error('❌ Error deleting documents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete documents',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list all documents
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all documents with embedding counts
    const { data: documents, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
    
    // Get embedding counts
    const documentsWithCounts = await Promise.all(
      (documents || []).map(async (doc) => {
        const { count } = await supabase
          .from('document_embeddings')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id);
        
        return {
          ...doc,
          embedding_count: count || 0
        };
      })
    );
    
    return NextResponse.json({
      documents: documentsWithCounts,
      total: documentsWithCounts.length
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching documents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch documents',
        details: error.message 
      },
      { status: 500 }
    );
  }
}