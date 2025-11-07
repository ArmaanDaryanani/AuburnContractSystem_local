import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export async function extractTextFromImage(
  imageData: string | File | Blob,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  try {
    const worker = await Tesseract.createWorker({
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress * 100);
        }
      },
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    const { data } = await worker.recognize(imageData);

    await worker.terminate();

    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map(w => ({
        text: w.text,
        bbox: w.bbox,
      })),
    };
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('OCR extraction failed');
  }
}

export async function extractTextFromPDFPages(
  pdfFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  const totalPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    
    const textContent = await page.getTextContent();
    
    if (textContent.items.length === 0) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageData = canvas.toDataURL('image/png');
      const ocrResult = await extractTextFromImage(imageData);
      fullText += ocrResult.text + '\n\n';
    } else {
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    if (onProgress) {
      onProgress((pageNum / totalPages) * 100);
    }
  }

  return fullText;
}
