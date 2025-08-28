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
      try {
        // Dynamically import pdf-parse to avoid build issues
        const pdf = (await import('pdf-parse')).default;
        
        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Parse PDF
        const data = await pdf(buffer);
        
        // Clean up the text - fix spacing issues
        let cleanText = data.text;
        
        // Fix common PDF extraction issues
        cleanText = cleanText
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
          .replace(/(\w)([.!?])([A-Z])/g, '$1$2 $3') // Add space after sentence endings
          .replace(/(\d)([A-Za-z])/g, '$1 $2') // Add space between numbers and letters
          .replace(/([A-Za-z])(\d)/g, '$1 $2') // Add space between letters and numbers
          .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
          .trim();
        
        return NextResponse.json({ 
          text: cleanText,
          type: 'pdf',
          pages: data.numpages,
          info: data.info
        });
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Fallback if PDF parsing fails
        return NextResponse.json({ 
          text: `PDF Document: ${file.name}\n\nUnable to extract text. The file may be scanned or protected.`,
          type: 'pdf'
        });
      }
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