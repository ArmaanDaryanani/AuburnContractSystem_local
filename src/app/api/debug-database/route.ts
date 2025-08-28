import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Supabase not configured',
        env: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get documents
    const { data: documents, error: docError, count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact' });

    // Try to get embeddings
    const { data: embeddings, error: embError, count: embCount } = await supabase
      .from('document_embeddings')
      .select('id, document_id, chunk_index', { count: 'exact' })
      .limit(10);

    // Try to get contracts
    const { data: contracts, error: contractError, count: contractCount } = await supabase
      .from('contracts')
      .select('*', { count: 'exact' });

    return NextResponse.json({
      success: true,
      database: {
        url: supabaseUrl,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      knowledge_documents: {
        count: docCount,
        error: docError?.message,
        sample: documents?.slice(0, 3),
        hasData: !!documents && documents.length > 0
      },
      document_embeddings: {
        count: embCount,
        error: embError?.message,
        sample: embeddings?.slice(0, 3),
        hasData: !!embeddings && embeddings.length > 0
      },
      contracts: {
        count: contractCount,
        error: contractError?.message,
        hasData: !!contracts && contracts.length > 0
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}