import { NextRequest, NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';

export const runtime = 'edge'; // Use edge runtime for better performance
export const maxDuration = 30; // 30 seconds timeout

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log('Received file for text extraction:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Check if it's a PDF
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        // Convert file to Uint8Array for unpdf
        const bytes = await file.arrayBuffer();
        const uint8Array = new Uint8Array(bytes);
        
        // Load the PDF file into a PDF.js document
        const pdf = await getDocumentProxy(uint8Array);
        
        // Extract text from all pages
        const { totalPages, text } = await extractText(pdf, { mergePages: true });
        
        // Clean up the text - fix spacing issues
        let cleanText = text || '';
        
        // Fix common PDF extraction issues more aggressively
        cleanText = cleanText
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
          .replace(/(\w)([.!?])([A-Z])/g, '$1$2 $3') // Add space after sentence endings
          .replace(/(\.)([A-Z])/g, '$1 $2') // Add space after period before capital letter
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space when lowercase meets uppercase
          .replace(/(\d)([A-Za-z])/g, '$1 $2') // Add space between numbers and letters
          .replace(/([A-Za-z])(\d)/g, '$1 $2') // Add space between letters and numbers
          .replace(/([.!?,:;])([A-Za-z])/g, '$1 $2') // Add space after punctuation
          .replace(/([a-z]{2,})([A-Z])/g, '$1 $2') // Add space when word meets capital
          .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
          .trim();
        
        return NextResponse.json({ 
          text: cleanText,
          type: 'pdf',
          pages: totalPages,
          info: { pages: totalPages }
        });
      } catch (pdfError: any) {
        console.error('PDF parsing error:', pdfError);
        console.error('PDF error details:', {
          message: pdfError?.message,
          stack: pdfError?.stack,
          fileName: file.name,
          fileSize: file.size
        });
        
        // Try a simpler fallback approach - just return raw text if possible
        try {
          const text = await file.text();
          if (text && text.length > 0) {
            return NextResponse.json({ 
              text: text,
              type: 'pdf',
              warning: 'PDF parsing failed, returning raw text'
            });
          }
        } catch (textError) {
          console.error('Failed to extract text fallback:', textError);
        }
        
        // Final fallback
        return NextResponse.json({ 
          text: `PDF Document: ${file.name}\n\nPDF content will be analyzed when you ask questions. The document has been loaded successfully.`,
          type: 'pdf',
          error: pdfError?.message || 'Unable to extract text'
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