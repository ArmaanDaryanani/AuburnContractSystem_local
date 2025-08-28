import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const checks = {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    },
    supabase: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
      canConnect: false,
      error: null as string | null,
    },
    openrouter: {
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      keyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 20),
      model: process.env.OPENROUTER_MODEL,
    },
    openai: {
      hasApiKey: !!process.env.OPENAI_API_KEY,
      keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 20),
    },
  };

  // Try to connect to Supabase
  if (checks.supabase.hasUrl && checks.supabase.hasAnonKey) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Try a simple query to test connection
      const { error } = await supabase.from('knowledge_documents').select('count').limit(1);
      
      if (!error) {
        checks.supabase.canConnect = true;
      } else {
        checks.supabase.error = error.message;
      }
    } catch (e) {
      checks.supabase.error = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  const isHealthy = checks.supabase.canConnect && checks.openrouter.hasApiKey;

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, {
    status: isHealthy ? 200 : 503,
  });
}