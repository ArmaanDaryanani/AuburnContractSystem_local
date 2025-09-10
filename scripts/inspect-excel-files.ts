#!/usr/bin/env tsx

/**
 * Script to inspect the structure of Excel files
 */

import * as XLSX from 'xlsx';

const FAR_MATRIX_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/2023-03-20_FAR Matrix.xls';
const CONTRACT_TERMS_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/Contract Ts&Cs Matrix.xlsm';

function inspectExcel(filePath: string, fileName: string) {
  console.log(`\n📊 Inspecting ${fileName}`);
  console.log('═══════════════════════════════════════\n');
  
  const workbook = XLSX.readFile(filePath);
  
  console.log(`Sheets found: ${workbook.SheetNames.join(', ')}\n`);
  
  // Inspect first sheet in detail
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  console.log(`\nSheet: ${firstSheet}`);
  console.log('─────────────────────');
  
  if (data.length > 0) {
    // Show headers
    const headers = data[0];
    console.log('\nHeaders:');
    headers.forEach((header: any, index: number) => {
      console.log(`  Column ${index}: ${header || '[empty]'}`);
    });
    
    // Show first few data rows
    console.log('\nFirst 3 data rows:');
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      console.log(`\nRow ${i}:`);
      const row = data[i];
      headers.forEach((header: any, index: number) => {
        const value = row[index];
        if (value !== undefined && value !== null && value !== '') {
          console.log(`  ${header || `Col${index}`}: ${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}`);
        }
      });
    }
  }
  
  // Check other sheets briefly
  if (workbook.SheetNames.length > 1) {
    console.log('\n\nOther sheets summary:');
    for (let i = 1; i < Math.min(3, workbook.SheetNames.length); i++) {
      const sheetName = workbook.SheetNames[i];
      const ws = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      console.log(`  ${sheetName}: ${sheetData.length} rows, ${sheetData[0]?.length || 0} columns`);
    }
  }
}

// Run inspection
console.log('🔍 Excel File Structure Inspector');
console.log('=====================================');

inspectExcel(FAR_MATRIX_PATH, 'FAR Matrix');
inspectExcel(CONTRACT_TERMS_PATH, 'Contract Terms Matrix');

console.log('\n✅ Inspection complete');