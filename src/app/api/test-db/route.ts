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
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test each table
    const results: any = {
      connection: 'success',
      tables: {}
    };

    // Test knowledge_documents
    try {
      const { data, error, count } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: false })
        .limit(5);
      
      results.tables.knowledge_documents = {
        count: count || 0,
        error: error?.message,
        sample: data?.slice(0, 2),
        hasData: !!data && data.length > 0
      };
    } catch (e) {
      results.tables.knowledge_documents = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Test document_embeddings
    try {
      const { data, error, count } = await supabase
        .from('document_embeddings')
        .select('id, document_id, chunk_index, chunk_text', { count: 'exact', head: false })
        .limit(5);
      
      results.tables.document_embeddings = {
        count: count || 0,
        error: error?.message,
        sample: data?.slice(0, 2),
        hasData: !!data && data.length > 0
      };
    } catch (e) {
      results.tables.document_embeddings = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Test contracts
    try {
      const { data, error, count } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: false })
        .limit(5);
      
      results.tables.contracts = {
        count: count || 0,
        error: error?.message,
        sample: data?.slice(0, 2),
        hasData: !!data && data.length > 0
      };
    } catch (e) {
      results.tables.contracts = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Test contract_analyses
    try {
      const { data, error, count } = await supabase
        .from('contract_analyses')
        .select('*', { count: 'exact', head: false })
        .limit(5);
      
      results.tables.contract_analyses = {
        count: count || 0,
        error: error?.message,
        sample: data?.slice(0, 2),
        hasData: !!data && data.length > 0
      };
    } catch (e) {
      results.tables.contract_analyses = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({ 
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}