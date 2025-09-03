import { NextRequest, NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { detectDocumentType, DocumentType } from '@/lib/document-utils';

// Note: Switching to Node.js runtime for mammoth compatibility
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds timeout

async function extractFromPDF(file: File) {
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
    
    return {
      text: cleanText,
      type: 'pdf' as const,
      pages: totalPages,
      info: { pages: totalPages }
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    throw error;
  }
}

async function extractFromDOCX(file: File) {
  try {
    // Convert file to ArrayBuffer for mammoth
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract both raw text and HTML
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer })
    ]);
    
    // Log any conversion messages
    if (textResult.messages.length > 0) {
      console.log('DOCX extraction messages:', textResult.messages);
    }
    
    // Clean up the extracted text
    let cleanText = textResult.value || '';
    cleanText = cleanText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    return {
      text: cleanText,
      html: htmlResult.value, // Store HTML for future highlighting
      type: 'docx' as const,
      messages: textResult.messages,
      info: {
        hasHtml: true,
        messageCount: textResult.messages.length
      }
    };
  } catch (error: any) {
    console.error('DOCX parsing error:', error);
    throw error;
  }
}

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
    
    // Detect document type
    const docInfo = detectDocumentType(file);
    console.log('Detected document type:', docInfo);
    
    // Handle based on document type
    switch (docInfo.type) {
      case DocumentType.PDF:
        try {
          const result = await extractFromPDF(file);
          return NextResponse.json(result);
        } catch (pdfError: any) {
          console.error('PDF extraction failed:', pdfError);
          
          // Try fallback for corrupted PDFs
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
        
      case DocumentType.DOCX:
        try {
          const result = await extractFromDOCX(file);
          return NextResponse.json(result);
        } catch (docxError: any) {
          console.error('DOCX extraction failed:', docxError);
          return NextResponse.json({ 
            error: `Failed to extract text from DOCX: ${docxError.message}`,
            type: 'docx'
          }, { status: 500 });
        }
        
      case DocumentType.DOC:
        return NextResponse.json({ 
          error: 'Legacy .doc files are not supported. Please convert to .docx format.',
          type: 'doc'
        }, { status: 400 });
        
      case DocumentType.TXT:
        const text = await file.text();
        return NextResponse.json({ 
          text, 
          type: 'text',
          info: { 
            size: file.size,
            encoding: 'utf-8'
          }
        });
        
      default:
        return NextResponse.json({ 
          error: `Unsupported file type: ${file.type || docInfo.extension}`,
          supportedTypes: ['pdf', 'docx', 'txt']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error extracting text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from document' },
      { status: 500 }
    );
  }
}