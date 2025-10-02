import { NextResponse } from 'next/server';

export async function GET() {
  // Check which environment variables are available
  const envCheck = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    
    // Show partial values for debugging (first 20 chars)
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
    openRouterKeyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 20),
    
    // Node environment
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  };

  return NextResponse.json(envCheck);
}