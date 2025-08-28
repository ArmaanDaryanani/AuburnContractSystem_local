import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    // Fetch document chunks from Supabase
    const { data: chunks, error } = await supabase
      .from('document_embeddings')
      .select('chunk_text, chunk_index')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });
    
    if (error) {
      console.error('Error fetching document:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document' },
        { status: 500 }
      );
    }
    
    // Combine chunks into full document text
    const fullContent = chunks
      ?.map(chunk => chunk.chunk_text)
      .join('\n\n') || '';
    
    return NextResponse.json({
      content: fullContent,
      chunks: chunks?.length || 0
    });
    
  } catch (error) {
    console.error('Error in document API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}