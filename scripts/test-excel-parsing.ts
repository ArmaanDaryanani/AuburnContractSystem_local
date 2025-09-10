#!/usr/bin/env tsx

/**
 * Test script to examine Excel file contents and fix parsing issues
 */

import * as XLSX from 'xlsx';
import path from 'path';

const FAR_MATRIX_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/2023-03-20_FAR Matrix.xls';
const CONTRACT_TERMS_PATH = '/Users/armaandaryanani/Desktop/AI Sample Agreements-selected/Contract Ts&Cs Matrix.xlsm';

function analyzeFARMatrix() {
  console.log('\n📊 Analyzing FAR Matrix Structure...\n');
  
  const workbook = XLSX.readFile(FAR_MATRIX_PATH);
  
  // Analyze the first sheet in detail
  const firstSheet = workbook.SheetNames[0];
  console.log(`\nAnalyzing sheet: ${firstSheet}`);
  
  const worksheet = workbook.Sheets[firstSheet];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Show first 5 rows to understand structure
  console.log('\nFirst 5 rows of data:');
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i] as any[];
    console.log(`Row ${i}:`, row.slice(0, 10)); // Show first 10 columns
  }
  
  // Try to identify headers
  const headers = data[0] as string[];
  console.log('\nHeaders found:', headers);
  
  // Try sheet_to_json with default headers
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  console.log('\nFirst 3 records as JSON:');
  console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
  
  // Check for FAR section patterns
  console.log('\nSearching for FAR section patterns...');
  for (let i = 1; i < Math.min(10, data.length); i++) {
    const row = data[i] as any[];
    for (let j = 0; j < row.length; j++) {
      const cell = row[j]?.toString() || '';
      if (cell.match(/\d+\.\d+/) || cell.match(/FAR/i) || cell.match(/52\./)) {
        console.log(`  Found potential FAR reference at row ${i}, col ${j}: "${cell.substring(0, 50)}"`);
      }
    }
  }
}

function analyzeContractTerms() {
  console.log('\n\n📄 Analyzing Contract Terms Matrix Structure...\n');
  
  const workbook = XLSX.readFile(CONTRACT_TERMS_PATH);
  
  // Analyze a meaningful sheet
  const sheetName = 'Termination'; // Pick a specific sheet
  console.log(`\nAnalyzing sheet: ${sheetName}`);
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Show first 5 rows
  console.log('\nFirst 5 rows of data:');
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i] as any[];
    console.log(`Row ${i}:`, row.slice(0, 5)); // Show first 5 columns
  }
  
  // Try sheet_to_json with default headers
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  console.log('\nFirst 3 records as JSON:');
  console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
  
  // Look for Auburn-specific patterns
  console.log('\nSearching for Auburn-specific content...');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i] as any[];
    for (let j = 0; j < row.length; j++) {
      const cell = row[j]?.toString() || '';
      if (cell.toLowerCase().includes('auburn') || cell.toLowerCase().includes('alternative')) {
        console.log(`  Found Auburn reference at row ${i}, col ${j}: "${cell.substring(0, 100)}..."`);
      }
    }
  }
}

// Run analysis
console.log('='.repeat(60));
console.log('EXCEL FILE CONTENT ANALYSIS');
console.log('='.repeat(60));

analyzeFARMatrix();
analyzeContractTerms();

console.log('\n' + '='.repeat(60));
console.log('Analysis complete!');