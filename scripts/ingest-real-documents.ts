#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import after env vars are loaded
import { ingestDocument } from '../src/lib/rag/document-ingestion';

interface DocumentToIngest {
  path: string;
  title: string;
  type: string;
  metadata?: any;
}

const documentsToIngest: DocumentToIngest[] = [
  {
    path: '/Users/armaandaryanani/Downloads/FAR.pdf',
    title: 'Federal Acquisition Regulation (FAR) - Complete',
    type: 'far_matrix',  // Changed to match database constraint
    metadata: {
      source: 'official',
      category: 'federal_regulation',
      last_updated: '2024'
    }
  },
  {
    path: '/Users/armaandaryanani/Downloads/AU-Contract-Mgt-Guide-2015.pdf',
    title: 'Auburn University Contract Management Guide',
    type: 'auburn_policy',
    metadata: {
      source: 'auburn_university',
      category: 'contracting_principles',
      version: '2015',
      department: 'Risk Management'
    }
  },
  {
    path: '/Users/armaandaryanani/Downloads/Auburn_University_General_Terms_And_Conditions.pdf',
    title: 'Auburn University General Terms and Conditions',
    type: 'approved_alternative',  // Changed to match database constraint
    metadata: {
      source: 'auburn_university',
      category: 'standard_terms',
      usage: 'template'
    }
  },
  {
    path: '/Users/armaandaryanani/Downloads/FromRiskManagement-VendorExhibitorAGREEMENT2021-Accessible.pdf',
    title: 'Vendor/Exhibitor/Third Party Entity Agreement Form',
    type: 'contract_template',
    metadata: {
      source: 'auburn_university',
      category: 'vendor_agreement',
      version: '2021',
      department: 'Risk Management'
    }
  }
];

async function parsePDFDocument(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF ${filePath}:`, error);
    throw error;
  }
}

async function ingestRealDocuments() {
  console.log('🚀 Starting Real Document Ingestion for Auburn Contract Review\n');
  console.log('=' .repeat(60));
  
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as any[]
  };

  for (const doc of documentsToIngest) {
    console.log(`\n📄 Processing: ${doc.title}`);
    console.log(`   Path: ${doc.path}`);
    console.log(`   Type: ${doc.type}`);
    
    try {
      // Check if file exists
      if (!fs.existsSync(doc.path)) {
        console.error(`   ❌ File not found: ${doc.path}`);
        results.failed++;
        results.errors.push({ document: doc.title, error: 'File not found' });
        continue;
      }

      // Parse PDF content
      console.log('   📖 Parsing PDF content...');
      const content = await parsePDFDocument(doc.path);
      
      // Get file stats
      const stats = fs.statSync(doc.path);
      const fileSizeKB = Math.round(stats.size / 1024);
      const contentLength = content.length;
      
      console.log(`   ✅ Parsed successfully!`);
      console.log(`      - File size: ${fileSizeKB} KB`);
      console.log(`      - Content length: ${contentLength} characters`);
      console.log(`      - Estimated chunks: ${Math.ceil(contentLength / 1000)}`);
      
      // Ingest into database with RAG
      console.log('   🔄 Ingesting into Supabase with embeddings...');
      
      const documentId = await ingestDocument(
        doc.title,
        content,
        doc.type,
        {
          ...doc.metadata,
          file_size_kb: fileSizeKB,
          character_count: contentLength,
          ingested_at: new Date().toISOString()
        }
      );
      
      console.log(`   ✅ Successfully ingested! Document ID: ${documentId}`);
      results.successful++;
      
    } catch (error) {
      console.error(`   ❌ Error processing document:`, error);
      results.failed++;
      results.errors.push({ document: doc.title, error });
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 INGESTION SUMMARY\n');
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(e => {
      console.log(`   - ${e.document}: ${e.error}`);
    });
  }
  
  if (results.successful > 0) {
    console.log('\n✨ SUCCESS! Real Auburn documents are now in your RAG system!');
    console.log('\n🎯 Next Steps:');
    console.log('1. The documents are now searchable via vector similarity');
    console.log('2. Contract analysis will use real Auburn policies');
    console.log('3. FAR compliance checks will reference actual regulations');
    console.log('4. Alternative language suggestions will be Auburn-approved');
    
    console.log('\n💡 To test the RAG system with real data:');
    console.log('   npm run test-rag');
    console.log('\n🚀 Your contract review system is now using REAL Auburn data!');
  }
}

// Run the ingestion
ingestRealDocuments().catch(error => {
  console.error('Fatal error during document ingestion:', error);
  process.exit(1);
});