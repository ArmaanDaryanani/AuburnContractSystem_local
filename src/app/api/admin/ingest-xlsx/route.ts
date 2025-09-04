import { NextRequest, NextResponse } from 'next/server';
import { ingestXLSXDocument } from '@/lib/rag/xlsx-ingestion';

export async function POST(request: NextRequest) {
  try {
    console.log('📊 XLSX ingestion endpoint called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const documentType = formData.get('documentType') as string || 'policy_matrix';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!title) {
      return NextResponse.json(
        { error: 'No title provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File must be an Excel spreadsheet (.xlsx or .xls)' },
        { status: 400 }
      );
    }
    
    console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`);
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Ingest the XLSX document
    const result = await ingestXLSXDocument(
      title,
      arrayBuffer,
      documentType,
      {
        original_filename: file.name,
        file_size: file.size,
        uploaded_at: new Date().toISOString()
      }
    );
    
    console.log('✅ XLSX ingestion complete:', result);
    
    return NextResponse.json({
      message: 'XLSX document successfully ingested',
      ...result
    });
    
  } catch (error: any) {
    console.error('❌ Error in XLSX ingestion endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to ingest XLSX document',
        details: error.message 
      },
      { status: 500 }
    );
  }
}