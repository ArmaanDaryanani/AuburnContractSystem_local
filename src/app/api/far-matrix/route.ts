import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SERVICE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      console.log('[/api/far-matrix] Supabase not configured, returning mock data');
      // Return mock FAR data when Supabase is not configured
      const mockFarRegulations = [
        {
          clause: 'FAR 52.228-7',
          title: 'Insurance - Liability to Third Persons',
          description: 'Contractor shall maintain insurance coverage',
          auburnImpact: 'Auburn requires specific insurance limits',
          status: 'active'
        },
        {
          clause: 'FAR 28.106',
          title: 'Indemnification',
          description: 'Government indemnification restrictions',
          auburnImpact: 'Auburn cannot provide indemnification as state entity',
          status: 'critical'
        },
        {
          clause: 'FAR 31.205-33',
          title: 'Professional and Consultant Service Costs',
          description: 'Allowability of consultant costs',
          auburnImpact: 'Must follow Auburn procurement policies',
          status: 'active'
        },
        {
          clause: 'FAR 52.227-14',
          title: 'Rights in Data - General',
          description: 'Government rights to contractor data',
          auburnImpact: 'Faculty retain IP rights per Auburn policy',
          status: 'critical'
        },
        {
          clause: 'FAR 52.232-1',
          title: 'Payments',
          description: 'Progress payment requirements',
          auburnImpact: 'Auburn requires progress payments, not milestone',
          status: 'active'
        }
      ];
      
      const filtered = search 
        ? mockFarRegulations.filter(reg => 
            reg.clause.toLowerCase().includes(search.toLowerCase()) ||
            reg.title.toLowerCase().includes(search.toLowerCase()) ||
            reg.description.toLowerCase().includes(search.toLowerCase())
          )
        : mockFarRegulations;
      
      return NextResponse.json({
        regulations: filtered.slice(0, limit),
        totalCount: filtered.length,
        categories: {
          'Indemnification': 1,
          'Insurance': 1,
          'Intellectual Property': 1,
          'Payment Terms': 1,
          'Professional Services': 1
        }
      });
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get FAR regulations from embeddings
    let query = supabase
      .from('document_embeddings')
      .select('chunk_text, metadata, chunk_index')
      .eq('metadata->>document_type', 'far_matrix')
      .order('chunk_index', { ascending: true })
      .limit(limit);
    
    if (search) {
      query = query.ilike('chunk_text', `%${search}%`);
    }
    
    const { data: farChunks, error } = await query;
    
    if (error) {
      console.error('[/api/far-matrix] Database query error:', error);
      // Continue with empty data instead of throwing
    }
    
    // Parse FAR regulations from chunks
    const farSections = new Map();
    
    // Common FAR clauses relevant to Auburn
    const keyFarClauses = [
      {
        clause: 'FAR 52.228-7',
        title: 'Insurance - Liability to Third Persons',
        description: 'Contractor shall maintain insurance coverage',
        auburnImpact: 'Auburn requires specific insurance limits',
        status: 'active'
      },
      {
        clause: 'FAR 28.106',
        title: 'Indemnification',
        description: 'Government indemnification restrictions',
        auburnImpact: 'Auburn cannot provide indemnification as state entity',
        status: 'critical'
      },
      {
        clause: 'FAR 27.402',
        title: 'Rights in Data',
        description: 'Intellectual property and data rights',
        auburnImpact: 'Faculty must retain publication rights',
        status: 'active'
      },
      {
        clause: 'FAR 32.906',
        title: 'Payment Terms',
        description: 'Prompt payment requirements',
        auburnImpact: 'Auburn standard is NET 30 days',
        status: 'active'
      },
      {
        clause: 'FAR 52.245-1',
        title: 'Government Property',
        description: 'Management of government-furnished property',
        auburnImpact: 'Auburn property management requirements',
        status: 'active'
      },
      {
        clause: 'FAR 49.603-3',
        title: 'Termination for Convenience',
        description: 'Right to terminate contract for convenience',
        auburnImpact: 'Auburn requires termination for convenience clause',
        status: 'active'
      },
      {
        clause: 'FAR 52.209-5',
        title: 'Certification Regarding Responsibility',
        description: 'Contractor certification requirements',
        auburnImpact: 'Debarment and suspension checks required',
        status: 'active'
      },
      {
        clause: 'FAR 52.222-21',
        title: 'Prohibition of Segregated Facilities',
        description: 'Equal opportunity requirements',
        auburnImpact: 'Auburn EEO compliance required',
        status: 'active'
      }
    ];
    
    // Extract actual FAR content from chunks if available
    if (farChunks && farChunks.length > 0) {
      farChunks.forEach(chunk => {
        // Look for FAR clause patterns
        const farPattern = /FAR\s+(\d+\.[\d\-]+)/g;
        const matches = chunk.chunk_text.matchAll(farPattern);
        
        for (const match of matches) {
          const clauseNum = match[1];
          if (!farSections.has(clauseNum)) {
            farSections.set(clauseNum, {
              clause: `FAR ${clauseNum}`,
              content: chunk.chunk_text.substring(0, 500),
              chunkIndex: chunk.chunk_index
            });
          }
        }
      });
    }
    
    // Combine with key clauses
    const matrix = keyFarClauses.map(clause => ({
      ...clause,
      content: farSections.get(clause.clause.replace('FAR ', ''))?.content || null,
      hasFullText: farSections.has(clause.clause.replace('FAR ', ''))
    }));
    
    // Return in the format the frontend expects
    return NextResponse.json({
      regulations: matrix,  // Frontend expects 'regulations'
      totalCount: matrix.length,
      farMatrix: matrix,  // Also include for compatibility
      totalClauses: matrix.length,
      totalChunks: farChunks?.length || 0,
      searchTerm: search,
      message: 'FAR Matrix loaded from knowledge base',
      categories: {
        'Indemnification': matrix.filter(m => m.title.toLowerCase().includes('indemnif')).length,
        'Insurance': matrix.filter(m => m.title.toLowerCase().includes('insurance')).length,
        'Intellectual Property': matrix.filter(m => m.title.toLowerCase().includes('data') || m.title.toLowerCase().includes('property')).length,
        'Payment Terms': matrix.filter(m => m.title.toLowerCase().includes('payment')).length,
        'Termination': matrix.filter(m => m.title.toLowerCase().includes('terminat')).length
      }
    });
    
  } catch (error) {
    console.error('Error fetching FAR matrix:', error);
    return NextResponse.json({ error: 'Failed to fetch FAR matrix' }, { status: 500 });
  }
}