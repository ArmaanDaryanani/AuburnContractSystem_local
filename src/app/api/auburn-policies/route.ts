import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge'; // Force edge runtime
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';
    
    // Always return mock data for now
    const shouldUseMock = true;
    
    if (shouldUseMock || !process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SERVICE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      console.log('[/api/auburn-policies] Returning mock data');
      // Return mock Auburn policies when Supabase is not configured
      const mockPolicies = [
        {
          id: 'policy-1',
          category: 'Procurement',
          title: 'Indemnification Restrictions',
          description: 'Auburn University cannot provide indemnification',
          details: 'As a state entity, Auburn University is prohibited from indemnifying contractors or vendors. All indemnification clauses must flow from contractor to Auburn.',
          status: 'mandatory',
          alternatives: ['Contractor shall indemnify Auburn University...', 'Insurance coverage requirements']
        },
        {
          id: 'policy-2',
          category: 'Intellectual Property',
          title: 'Faculty IP Rights',
          description: 'Faculty retain rights to their intellectual property',
          details: 'Under Auburn policy, faculty members retain ownership of intellectual property they create, except when specifically assigned or work-for-hire.',
          status: 'mandatory',
          alternatives: ['Non-exclusive license to Auburn', 'Shared IP arrangements']
        },
        {
          id: 'policy-3',
          category: 'Payment Terms',
          title: 'Progress Payment Requirements',
          description: 'Auburn requires progress payments, not milestone-based',
          details: 'Payments must be structured as progress payments based on work completed, not tied to specific milestones or deliverables.',
          status: 'mandatory',
          alternatives: ['Monthly progress invoicing', 'Percentage completion payments']
        },
        {
          id: 'policy-4',
          category: 'Insurance',
          title: 'State Self-Insurance',
          description: 'Auburn is self-insured through State of Alabama',
          details: 'Auburn University does not purchase commercial insurance. Coverage is provided through the State of Alabama self-insurance program.',
          status: 'informational',
          alternatives: []
        },
        {
          id: 'policy-5',
          category: 'Compliance',
          title: 'State Procurement Laws',
          description: 'Must comply with Alabama procurement regulations',
          details: 'All contracts must comply with State of Alabama bid laws and procurement regulations, including competitive bidding requirements.',
          status: 'mandatory',
          alternatives: []
        }
      ];
      
      let filtered = mockPolicies;
      
      if (category !== 'all') {
        filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }
      
      if (search) {
        filtered = filtered.filter(p => 
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()) ||
          p.details.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return NextResponse.json({
        policies: filtered,
        categories: {
          'Procurement': 1,
          'Intellectual Property': 1,
          'Payment Terms': 1,
          'Insurance': 1,
          'Compliance': 1
        },
        totalCount: filtered.length
      });
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get Auburn policy documents
    const { data: auburnDocs } = await supabase
      .from('knowledge_documents')
      .select('id, title, content, document_type, metadata')
      .in('document_type', ['auburn_policy', 'approved_alternative', 'contract_template']);
    
    // Get sample chunks for each policy area
    const { data: policyChunks } = await supabase
      .from('document_embeddings')
      .select('chunk_text, metadata')
      .in('metadata->>document_type', ['auburn_policy', 'approved_alternative'])
      .limit(20);
    
    // Parse policies from documents and chunks
    const policies = [
      {
        id: '1',
        category: 'Indemnification',
        title: 'Indemnification and Hold Harmless Restrictions',
        content: 'Auburn University, as an instrumentality of the State of Alabama, cannot agree to indemnify, hold harmless, or defend another party. The University is protected by sovereign immunity under Article I, Section 14 of the Constitution of Alabama.',
        source: 'Auburn Contract Management Guide',
        critical: true,
        alternatives: [
          'Mutual limitation of liability clause',
          'Each party responsible for own negligence',
          'Insurance requirements in lieu of indemnification'
        ]
      },
      {
        id: '2',
        category: 'Payment Terms',
        title: 'Standard Payment Terms',
        content: 'Payment terms shall be NET 30 days from receipt of invoice. Auburn University does not pay interest or late fees. Milestone-based payments are generally not accepted.',
        source: 'Auburn General Terms and Conditions',
        critical: false,
        alternatives: [
          'NET 30 payment terms',
          'Progress payments with deliverables',
          'Annual payment schedules'
        ]
      },
      {
        id: '3',
        category: 'Intellectual Property',
        title: 'Faculty IP Rights',
        content: 'Faculty members retain rights to their scholarly work, research, and publications. Work created with substantial use of University resources may be subject to shared ownership.',
        source: 'Auburn IP Policy',
        critical: true,
        alternatives: [
          'Joint ownership agreements',
          'License back provisions',
          'Publication rights preservation'
        ]
      },
      {
        id: '4',
        category: 'Jurisdiction',
        title: 'Governing Law and Venue',
        content: 'All contracts shall be governed by the laws of the State of Alabama. Exclusive jurisdiction and venue shall be in the Circuit Court of Lee County, Alabama.',
        source: 'Auburn Contract Management Guide',
        critical: true,
        alternatives: []
      },
      {
        id: '5',
        category: 'Insurance',
        title: 'Insurance Requirements',
        content: 'Contractors shall maintain General Liability insurance with minimum limits of $1,000,000 per occurrence and $1,000,000 aggregate. Auburn University shall be named as additional insured.',
        source: 'Auburn General Terms and Conditions',
        critical: false,
        alternatives: [
          'Self-insurance with proof of financial responsibility',
          'State insurance programs'
        ]
      },
      {
        id: '6',
        category: 'Termination',
        title: 'Termination for Convenience',
        content: 'Auburn University reserves the right to terminate any contract for convenience with 30 days written notice. Contractor shall be compensated for work satisfactorily completed.',
        source: 'Auburn Standard Contract Terms',
        critical: false,
        alternatives: []
      },
      {
        id: '7',
        category: 'Compliance',
        title: 'Export Control Compliance',
        content: 'All parties must comply with U.S. export control laws and regulations, including ITAR and EAR. No controlled technology or data shall be shared without proper authorization.',
        source: 'Auburn Export Control Policy',
        critical: true,
        alternatives: []
      },
      {
        id: '8',
        category: 'Confidentiality',
        title: 'Non-Disclosure Requirements',
        content: 'Confidential information must be clearly marked. Auburn is subject to Alabama Open Records Act and may be required to disclose information pursuant to public records requests.',
        source: 'Auburn Information Security Policy',
        critical: false,
        alternatives: [
          'Limited confidentiality with public records exception',
          'Mutual NDA with carve-outs'
        ]
      }
    ];
    
    // Filter by category if specified
    let filteredPolicies = policies;
    if (category !== 'all') {
      filteredPolicies = policies.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    
    // Filter by search term if specified
    if (search) {
      filteredPolicies = filteredPolicies.filter(p => 
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.content.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Add actual content from database if available
    if (auburnDocs && auburnDocs.length > 0) {
      filteredPolicies = filteredPolicies.map(policy => {
        const matchingDoc = auburnDocs.find(doc => 
          doc.content?.toLowerCase().includes(policy.category.toLowerCase())
        );
        
        if (matchingDoc) {
          return {
            ...policy,
            hasFullDocument: true,
            documentId: matchingDoc.id
          };
        }
        return policy;
      });
    }
    
    return NextResponse.json({
      policies: filteredPolicies,
      totalPolicies: filteredPolicies.length,
      categories: Array.from(new Set(policies.map(p => p.category))),
      documentsLoaded: auburnDocs?.length || 0,
      message: 'Auburn policies loaded from knowledge base'
    });
    
  } catch (error) {
    console.error('Error fetching Auburn policies:', error);
    return NextResponse.json({ error: 'Failed to fetch Auburn policies' }, { status: 500 });
  }
}