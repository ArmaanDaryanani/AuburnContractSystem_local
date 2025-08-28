import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Supabase not configured'
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if data already exists
    const { count: existingDocs } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true });
      
    if (existingDocs && existingDocs > 0) {
      return NextResponse.json({
        message: 'Database already initialized',
        documentCount: existingDocs
      });
    }

    // Add initial documents
    const { data: docs, error: insertError } = await supabase
      .from('knowledge_documents')
      .insert([
        {
          title: 'FAR Clauses Matrix',
          document_type: 'far_matrix',
          content: `Federal Acquisition Regulation (FAR) clauses applicable to Auburn University contracts.
          
          FAR 52.228-7 Insurance - Liability to Third Persons
          This clause requires contractors to maintain adequate insurance coverage for liability to third persons. Auburn University requires specific insurance limits: General liability of $1M per occurrence, $2M aggregate; Auto liability of $1M; Professional liability of $1M for professional services.
          
          FAR 28.106 Indemnification
          Government entities have restrictions on providing indemnification. As a state entity, Auburn University cannot provide unlimited indemnification. Any indemnification must be limited to the extent permitted by Alabama state law and must be approved by legal counsel.
          
          FAR 52.227-14 Rights in Data - General
          This clause addresses government rights to contractor-produced data. Auburn University modifies this to ensure faculty retain publication rights and intellectual property rights in accordance with university policy. Research data funded by federal grants must comply with federal data management requirements.
          
          FAR 31.205-33 Professional and Consultant Service Costs
          Defines allowability of consultant costs. Auburn requires that all consultant agreements follow university procurement policies, including competitive bidding for services over $25,000 and proper documentation of sole source justifications.
          
          FAR 52.232-1 Payments
          Addresses payment terms and progress payments. Auburn standard payment terms are NET 30 days from receipt of correct invoice. Progress payments may be negotiated for large contracts but require specific milestones and deliverables.
          
          FAR 52.245-1 Government Property
          Covers management of government-furnished property. Auburn requires detailed property management procedures including inventory tracking, maintenance schedules, and disposition instructions for all government property.`,
          metadata: { 
            file_size_mb: 12.7, 
            character_count: 450000,
            source: 'Federal Acquisition Regulation',
            last_updated: new Date().toISOString()
          }
        },
        {
          title: 'Auburn Procurement Policies',
          document_type: 'auburn_policy',
          content: `Auburn University Procurement and Contract Administration Policies
          
          1. PROCUREMENT THRESHOLDS
          - Under $5,000: Department discretion with proper documentation
          - $5,000 - $25,000: Three written quotes required
          - $25,000 - $50,000: Formal solicitation through Procurement Services
          - Over $50,000: Competitive bid or RFP required
          
          2. CONTRACT REVIEW REQUIREMENTS
          All contracts must be reviewed by:
          - Department head for contracts under $25,000
          - Procurement Services for contracts $25,000 - $100,000
          - Legal Affairs for contracts over $100,000
          - Risk Management for all contracts with insurance requirements
          
          3. PROHIBITED CONTRACT TERMS
          Auburn cannot agree to:
          - Unlimited indemnification
          - Waiver of sovereign immunity
          - Binding arbitration without opt-out provision
          - Choice of law other than Alabama
          - Advance payments without adequate security
          
          4. REQUIRED CONTRACT TERMS
          All contracts must include:
          - Clear scope of work and deliverables
          - Payment terms (NET 30 standard)
          - Termination for convenience clause
          - Non-discrimination clause
          - Export control compliance for international agreements
          
          5. INTELLECTUAL PROPERTY
          - Faculty retain rights to scholarly works
          - University owns work-for-hire by staff
          - Sponsored research IP follows sponsor requirements
          - Student IP rights protected per university policy`,
          metadata: { 
            file_size_mb: 0.45, 
            character_count: 22500,
            source: 'Auburn University Policy Manual',
            last_updated: new Date().toISOString()
          }
        },
        {
          title: 'Standard Contract Template',
          document_type: 'contract_template',
          content: `AUBURN UNIVERSITY STANDARD SERVICE AGREEMENT
          
          This Agreement is entered into between Auburn University ("University") and [Contractor Name] ("Contractor").
          
          1. SCOPE OF SERVICES
          Contractor shall provide the following services: [Detailed description of services]
          
          2. TERM
          This Agreement shall commence on [Start Date] and continue through [End Date], unless earlier terminated.
          
          3. COMPENSATION
          University shall pay Contractor [Amount] for satisfactory completion of services. Payment terms are NET 30 days from receipt of correct invoice.
          
          4. TERMINATION
          Either party may terminate this Agreement with 30 days written notice. University may terminate immediately for cause.
          
          5. INSURANCE
          Contractor shall maintain:
          - General Liability: $1,000,000 per occurrence
          - Professional Liability: $1,000,000 (if applicable)
          - Workers Compensation: As required by law
          
          6. INDEMNIFICATION
          To the extent permitted by Alabama law, each party shall indemnify the other for its negligent acts or omissions.
          
          7. INTELLECTUAL PROPERTY
          Work product created under this Agreement shall be owned by University, except for pre-existing IP which remains with Contractor.
          
          8. GOVERNING LAW
          This Agreement shall be governed by Alabama law. Venue shall be Lee County, Alabama.`,
          metadata: { 
            file_size_mb: 0.085, 
            character_count: 15000,
            source: 'Auburn Legal Department',
            last_updated: new Date().toISOString()
          }
        },
        {
          title: 'Approved Alternative Clauses',
          document_type: 'approved_alternative',
          content: `PRE-APPROVED ALTERNATIVE CONTRACT CLAUSES
          
          INDEMNIFICATION ALTERNATIVES:
          1. Mutual Indemnification (Preferred):
          "Each party shall defend, indemnify, and hold harmless the other party from claims arising from its negligent acts or omissions."
          
          2. Limited University Indemnification:
          "University's indemnification obligations are subject to the limitations of the Alabama Constitution and state law."
          
          PAYMENT TERMS ALTERNATIVES:
          1. Progress Payments:
          "University shall make progress payments within 30 days of receipt of invoice for completed milestones."
          
          2. Retainage:
          "University may withhold 10% retainage until final acceptance of all deliverables."
          
          TERMINATION ALTERNATIVES:
          1. Termination for Convenience:
          "University may terminate this Agreement for convenience with 30 days notice. Contractor shall be paid for work satisfactorily completed."
          
          2. Mutual Termination Rights:
          "Either party may terminate for convenience with 60 days written notice."
          
          DISPUTE RESOLUTION ALTERNATIVES:
          1. Mediation First:
          "Parties agree to attempt resolution through mediation before pursuing litigation."
          
          2. Senior Executive Resolution:
          "Disputes shall first be escalated to senior executives for good faith resolution attempts."`,
          metadata: { 
            file_size_mb: 0.12, 
            character_count: 18000,
            source: 'Auburn Contract Review Board',
            last_updated: new Date().toISOString()
          }
        }
      ])
      .select();

    if (insertError) {
      console.error('Error inserting documents:', insertError);
      return NextResponse.json({ 
        error: 'Failed to insert documents',
        details: insertError.message 
      }, { status: 500 });
    }

    // Add sample embeddings for each document (simplified - in production would use real embeddings)
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        // Create chunks based on document type
        const chunkCount = doc.document_type === 'far_matrix' ? 10 : 5;
        const chunks = [];
        
        // Split content into chunks
        const contentLength = doc.content.length;
        const chunkSize = Math.floor(contentLength / chunkCount);
        
        for (let i = 0; i < chunkCount; i++) {
          const start = i * chunkSize;
          const end = i === chunkCount - 1 ? contentLength : start + chunkSize;
          const chunkText = doc.content.substring(start, end);
          
          chunks.push({
            document_id: doc.id,
            chunk_text: chunkText,
            chunk_index: i,
            metadata: { 
              document_type: doc.document_type,
              document_title: doc.title,
              chunk_size: chunkText.length
            }
          });
        }
        
        const { error: embError } = await supabase
          .from('document_embeddings')
          .insert(chunks);
          
        if (embError) {
          console.error(`Error inserting embeddings for ${doc.title}:`, embError);
        }
      }
    }

    // Get final counts
    const { count: finalDocs } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true });
      
    const { count: finalEmbeddings } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      documents: finalDocs,
      embeddings: finalEmbeddings,
      insertedDocs: docs?.length || 0
    });

  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}