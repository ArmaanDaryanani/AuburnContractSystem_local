import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL
    },
    supabaseTest: {
      canConnect: false,
      tableExists: false,
      error: null as string | null
    }
  };

  try {
    // Test Supabase connection
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (url && key) {
      const supabase = createClient(url, key);
      
      // Test query
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('id')
        .limit(1);
      
      if (!error) {
        results.supabaseTest.canConnect = true;
        results.supabaseTest.tableExists = true;
      } else {
        results.supabaseTest.error = error.message;
      }
    }
  } catch (e) {
    results.supabaseTest.error = e instanceof Error ? e.message : 'Unknown error';
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      received: body,
      hasQuery: !!body.query,
      hasMessage: !!body.message,
      hasText: !!body.text,
      contentToAnalyze: body.text || body.message || body.query || 'NONE',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}