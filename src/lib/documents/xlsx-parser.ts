// XLSX Parser for Auburn Contract Review Documents
import * as XLSX from 'xlsx';

export interface XLSXParseOptions {
  preserveStructure: boolean;
  includeHeaders: boolean;
  sheetSelection?: string[];
  semanticColumns?: string[];
  metadataColumns?: string[];
}

export interface ParsedXLSXData {
  sheets: {
    name: string;
    data: any[][];
    headers: string[];
    semanticContent: string;
    metadata: Record<string, any>;
  }[];
  workbookMetadata: Record<string, any>;
}

export interface EmbeddingChunk {
  text: string;
  metadata: {
    sheet_name?: string;
    row_index?: number;
    column_headers?: string[];
    far_section?: string;
    policy_reference?: string;
    risk_level?: string;
    has_alternative?: boolean;
    chunk_type?: string;
    [key: string]: any;
  };
}

export async function parseXLSXFile(
  filePath: string | ArrayBuffer, 
  options: XLSXParseOptions = {
    preserveStructure: true,
    includeHeaders: true
  }
): Promise<ParsedXLSXData> {
  // Read the workbook
  const workbook = typeof filePath === 'string' 
    ? XLSX.readFile(filePath)
    : XLSX.read(filePath, { type: 'array' });
  
  const sheets: ParsedXLSXData['sheets'] = [];
  
  // Process each sheet
  for (const sheetName of workbook.SheetNames) {
    // Skip if sheet selection is provided and this sheet isn't in it
    if (options.sheetSelection && !options.sheetSelection.includes(sheetName)) {
      continue;
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (data.length === 0) continue;
    
    // Extract headers from first row if present
    const headers = options.includeHeaders && data.length > 0 ? data[0] : [];
    const dataRows = options.includeHeaders ? data.slice(1) : data;
    
    // Generate semantic content
    const semanticContent = generateSemanticContent(headers, dataRows);
    
    sheets.push({
      name: sheetName,
      data: dataRows,
      headers,
      semanticContent,
      metadata: {
        rowCount: dataRows.length,
        columnCount: headers.length || (dataRows[0]?.length || 0),
        hasHeaders: options.includeHeaders
      }
    });
  }
  
  return {
    sheets,
    workbookMetadata: {
      sheetCount: sheets.length,
      totalRows: sheets.reduce((sum, sheet) => sum + sheet.data.length, 0)
    }
  };
}

function generateSemanticContent(headers: string[], rows: any[][]): string {
  const chunks: string[] = [];
  
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    
    // Create semantic representation of the row
    const rowText = headers.length > 0
      ? headers.map((header, i) => `${header}: ${row[i] || 'N/A'}`).join(', ')
      : row.join(', ');
    
    chunks.push(rowText);
  }
  
  return chunks.join('\n');
}

export function convertSheetsToEmbeddingText(
  sheets: ParsedXLSXData['sheets'],
  strategy: 'row-wise' | 'column-wise' | 'semantic-chunks' = 'semantic-chunks'
): EmbeddingChunk[] {
  const chunks: EmbeddingChunk[] = [];
  
  for (const sheet of sheets) {
    if (strategy === 'row-wise') {
      // Each row becomes a chunk
      sheet.data.forEach((row, rowIndex) => {
        const text = sheet.headers.length > 0
          ? sheet.headers.map((header, i) => `${header}: ${row[i] || ''}`).join('. ')
          : row.join('. ');
        
        chunks.push({
          text,
          metadata: {
            sheet_name: sheet.name,
            row_index: rowIndex,
            column_headers: sheet.headers,
            chunk_type: 'row'
          }
        });
      });
    } else if (strategy === 'semantic-chunks') {
      // Group related rows into semantic chunks
      const chunkSize = 5; // Group 5 rows per chunk for context
      
      for (let i = 0; i < sheet.data.length; i += chunkSize) {
        const rowChunk = sheet.data.slice(i, i + chunkSize);
        const text = rowChunk.map((row, idx) => {
          if (sheet.headers.length > 0) {
            return `Row ${i + idx + 1}: ` + sheet.headers.map((header, j) => 
              `${header}: ${row[j] || ''}`
            ).join(', ');
          }
          return `Row ${i + idx + 1}: ${row.join(', ')}`;
        }).join('\n');
        
        chunks.push({
          text,
          metadata: {
            sheet_name: sheet.name,
            row_index: i,
            row_count: rowChunk.length,
            column_headers: sheet.headers,
            chunk_type: 'semantic_group'
          }
        });
      }
    }
  }
  
  return chunks;
}

// Auburn-specific XLSX processing strategies
export class AuburnXLSXProcessor {
  // Process FAR Matrix spreadsheet
  processFARMatrix(sheet: any[][], headers: string[]): EmbeddingChunk[] {
    const chunks: EmbeddingChunk[] = [];
    
    // Expected columns: FAR Section, Requirement, Auburn Policy, Compliance Notes
    const farSectionIdx = headers.findIndex(h => h?.toLowerCase().includes('far'));
    const requirementIdx = headers.findIndex(h => h?.toLowerCase().includes('requirement'));
    const auburnPolicyIdx = headers.findIndex(h => h?.toLowerCase().includes('auburn'));
    const notesIdx = headers.findIndex(h => h?.toLowerCase().includes('note') || h?.toLowerCase().includes('compliance'));
    
    sheet.forEach((row, index) => {
      const farSection = farSectionIdx >= 0 ? row[farSectionIdx] : '';
      const requirement = requirementIdx >= 0 ? row[requirementIdx] : '';
      const auburnPolicy = auburnPolicyIdx >= 0 ? row[auburnPolicyIdx] : '';
      const notes = notesIdx >= 0 ? row[notesIdx] : '';
      
      chunks.push({
        text: `FAR Section ${farSection}: ${requirement}. Auburn Policy: ${auburnPolicy}. Compliance Notes: ${notes}`,
        metadata: {
          sheet_type: 'far_matrix',
          far_section: farSection,
          row_index: index,
          policy_reference: auburnPolicy,
          chunk_type: 'far_compliance'
        }
      });
    });
    
    return chunks;
  }
  
  // Process Contract Terms spreadsheet
  processContractTerms(sheet: any[][], headers: string[]): EmbeddingChunk[] {
    const chunks: EmbeddingChunk[] = [];
    
    // Expected columns: Term Type, Standard Language, Alternative Language, Risk Level
    const termTypeIdx = headers.findIndex(h => h?.toLowerCase().includes('term'));
    const standardIdx = headers.findIndex(h => h?.toLowerCase().includes('standard'));
    const alternativeIdx = headers.findIndex(h => h?.toLowerCase().includes('alternative'));
    const riskIdx = headers.findIndex(h => h?.toLowerCase().includes('risk'));
    
    sheet.forEach((row, index) => {
      const termType = termTypeIdx >= 0 ? row[termTypeIdx] : '';
      const standardLang = standardIdx >= 0 ? row[standardIdx] : '';
      const altLang = alternativeIdx >= 0 ? row[alternativeIdx] : '';
      const riskLevel = riskIdx >= 0 ? row[riskIdx] : '';
      
      chunks.push({
        text: `Contract Term - ${termType}: Standard language: "${standardLang}". Auburn alternative: "${altLang}". Risk Level: ${riskLevel}`,
        metadata: {
          sheet_type: 'contract_terms',
          term_type: termType,
          risk_level: riskLevel,
          has_alternative: !!altLang,
          chunk_type: 'contract_term'
        }
      });
    });
    
    return chunks;
  }
  
  // Process Procurement Requirements spreadsheet
  processProcurementRequirements(sheet: any[][], headers: string[]): EmbeddingChunk[] {
    const chunks: EmbeddingChunk[] = [];
    
    // Expected columns: Threshold, Requirements, Approval Process
    const thresholdIdx = headers.findIndex(h => 
      h?.toLowerCase().includes('threshold') || h?.toLowerCase().includes('amount')
    );
    const requirementIdx = headers.findIndex(h => h?.toLowerCase().includes('requirement'));
    const approvalIdx = headers.findIndex(h => h?.toLowerCase().includes('approval'));
    
    sheet.forEach((row, index) => {
      const threshold = thresholdIdx >= 0 ? row[thresholdIdx] : '';
      const requirements = requirementIdx >= 0 ? row[requirementIdx] : '';
      const approval = approvalIdx >= 0 ? row[approvalIdx] : '';
      
      chunks.push({
        text: `Procurement at ${threshold}: Requirements: ${requirements}. Approval Process: ${approval}`,
        metadata: {
          sheet_type: 'procurement_requirements',
          threshold: threshold,
          row_index: index,
          chunk_type: 'procurement_rule'
        }
      });
    });
    
    return chunks;
  }
  
  // Detect sheet type and process accordingly
  autoProcessSheet(
    sheetName: string, 
    data: any[][], 
    headers: string[]
  ): EmbeddingChunk[] {
    const nameLower = sheetName.toLowerCase();
    
    if (nameLower.includes('far') || nameLower.includes('federal acquisition')) {
      return this.processFARMatrix(data, headers);
    } else if (nameLower.includes('term') || nameLower.includes('contract')) {
      return this.processContractTerms(data, headers);
    } else if (nameLower.includes('procurement') || nameLower.includes('purchase')) {
      return this.processProcurementRequirements(data, headers);
    } else {
      // Default to semantic chunks
      return convertSheetsToEmbeddingText([{
        name: sheetName,
        data,
        headers,
        semanticContent: '',
        metadata: {}
      }], 'semantic-chunks');
    }
  }
}