import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    };

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        envCheck,
        message: 'Check Vercel environment variables'
      }, { status: 500 });
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Test queries
    const tests: any = {
      environment: envCheck,
      queries: {}
    };

    // Test 1: Count knowledge_documents
    try {
      const { count, error } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true });
      
      tests.queries.knowledge_documents = {
        count: count || 0,
        error: error?.message || null,
        success: !error
      };
    } catch (e) {
      tests.queries.knowledge_documents = {
        error: e instanceof Error ? e.message : 'Unknown error',
        success: false
      };
    }

    // Test 2: Count document_embeddings
    try {
      const { count, error } = await supabase
        .from('document_embeddings')
        .select('*', { count: 'exact', head: true });
      
      tests.queries.document_embeddings = {
        count: count || 0,
        error: error?.message || null,
        success: !error
      };
    } catch (e) {
      tests.queries.document_embeddings = {
        error: e instanceof Error ? e.message : 'Unknown error',
        success: false
      };
    }

    // Test 3: Get sample document
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('id, title, document_type')
        .limit(1)
        .single();
      
      tests.queries.sample_document = {
        data: data || null,
        error: error?.message || null,
        success: !error
      };
    } catch (e) {
      tests.queries.sample_document = {
        error: e instanceof Error ? e.message : 'Unknown error',
        success: false
      };
    }

    // Test 4: Check if we can query with metadata
    try {
      const { data, error } = await supabase
        .from('document_embeddings')
        .select('id, metadata')
        .limit(5);
      
      tests.queries.metadata_query = {
        count: data?.length || 0,
        sample: data?.[0] || null,
        error: error?.message || null,
        success: !error
      };
    } catch (e) {
      tests.queries.metadata_query = {
        error: e instanceof Error ? e.message : 'Unknown error',
        success: false
      };
    }

    // Summary
    tests.summary = {
      totalDocuments: tests.queries.knowledge_documents?.count || 0,
      totalEmbeddings: tests.queries.document_embeddings?.count || 0,
      connectionSuccessful: tests.queries.knowledge_documents?.success && tests.queries.document_embeddings?.success,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(tests);
  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}