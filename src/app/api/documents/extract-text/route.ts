import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if it's a PDF
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // For now, return a message that PDF will be processed
      // In production, you'd use a library like pdf-parse or send to an API
      return NextResponse.json({ 
        text: `PDF Document: ${file.name}\n\nContent extraction in progress. The system will analyze this PDF when you ask questions about it.`,
        type: 'pdf'
      });
    }

    // For text files, read directly
    const text = await file.text();
    return NextResponse.json({ text, type: 'text' });

  } catch (error) {
    console.error('Error extracting text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from document' },
      { status: 500 }
    );
  }
}