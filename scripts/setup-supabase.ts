#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables!');
  console.log('\nPlease add the following to your .env.local file:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=your-supabase-url');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  console.log('SUPABASE_SERVICE_KEY=your-service-key (optional but recommended)');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigrations() {
  console.log('🚀 Setting up Supabase database...\n');
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();
  
  for (const file of migrationFiles) {
    if (!file.endsWith('.sql')) continue;
    
    console.log(`📝 Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    try {
      // Split SQL by semicolons and run each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single();
        
        if (error) {
          // If exec_sql doesn't exist, try direct execution (won't work with RLS)
          console.warn(`⚠️  Could not execute via RPC, statement might need manual execution`);
          console.log(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
      
      console.log(`✅ Migration ${file} completed`);
    } catch (error) {
      console.error(`❌ Error in migration ${file}:`, error);
    }
  }
}

async function seedData() {
  console.log('\n🌱 Seeding initial data...\n');
  
  try {
    // Check if data already exists
    const { data: existing } = await supabase
      .from('knowledge_documents')
      .select('id')
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log('ℹ️  Database already contains data, skipping seed');
      return;
    }
    
    // Load and insert seed data
    const seedFile = path.join(__dirname, '..', 'supabase', 'seeds', 'auburn-policies.json');
    const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
    
    // Insert policies
    for (const policy of seedData.policies) {
      const { error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: policy.title,
          content: policy.content,
          document_type: policy.type
        });
      
      if (error) {
        console.error(`Error inserting policy ${policy.title}:`, error);
      } else {
        console.log(`✅ Inserted policy: ${policy.title}`);
      }
    }
    
    // Insert FAR matrix
    for (const far of seedData.far_matrix) {
      const { error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: far.title,
          content: far.content,
          document_type: far.type
        });
      
      if (error) {
        console.error(`Error inserting FAR ${far.title}:`, error);
      } else {
        console.log(`✅ Inserted FAR: ${far.title}`);
      }
    }
    
    // Insert alternatives
    for (const alt of seedData.approved_alternatives) {
      const { error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: alt.title,
          content: alt.content,
          document_type: alt.type
        });
      
      if (error) {
        console.error(`Error inserting alternative ${alt.title}:`, error);
      } else {
        console.log(`✅ Inserted alternative: ${alt.title}`);
      }
    }
    
    console.log('\n✅ Seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

async function main() {
  console.log('================================');
  console.log('Auburn Contract Review RAG Setup');
  console.log('================================\n');
  
  // Note: Migrations need to be run via Supabase Dashboard SQL Editor
  console.log('⚠️  IMPORTANT: Database migrations need to be run manually');
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Run each migration file in order:');
  console.log('   - 001_enable_vector.sql');
  console.log('   - 002_create_knowledge_tables.sql');
  console.log('   - 003_create_search_functions.sql\n');
  
  // Seed initial data
  await seedData();
  
  console.log('\n================================');
  console.log('Setup Instructions Complete!');
  console.log('================================\n');
  console.log('Next steps:');
  console.log('1. Run the migrations in Supabase SQL Editor');
  console.log('2. Generate embeddings: npm run generate-embeddings');
  console.log('3. Test the system: npm run test-rag');
  console.log('\n✨ Your RAG system is ready to use!');
}

main().catch(console.error);