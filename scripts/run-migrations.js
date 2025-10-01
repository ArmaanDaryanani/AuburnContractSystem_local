const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Your Supabase credentials (from environment variables)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Running RAG Database Setup...\n');
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'setup-rag-database.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  
  // Split by major sections (separated by ===== comments)
  const sections = sqlContent.split(/-- =+\n-- STEP/);
  
  for (let i = 0; i < sections.length; i++) {
    if (!sections[i].trim()) continue;
    
    const section = i === 0 ? sections[i] : '-- STEP' + sections[i];
    const sectionName = section.match(/STEP \d+: ([^\n]+)/)?.[1] || `Section ${i}`;
    
    console.log(`\n📝 Running: ${sectionName}`);
    
    // Split by semicolons but preserve those in function definitions
    const statements = section.split(/;(?![^$$]*\$\$)/);
    
    for (const statement of statements) {
      const cleanStatement = statement.trim();
      if (!cleanStatement || cleanStatement.startsWith('--')) continue;
      
      try {
        // For complex statements, we need to use raw SQL execution
        // Supabase JS client doesn't have direct SQL execution, so we'll use RPC
        // But first, let's try to identify the type of statement
        
        if (cleanStatement.includes('CREATE EXTENSION')) {
          console.log('  ⏩ Extensions must be enabled in Supabase Dashboard');
          console.log('     Go to: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/database/extensions');
          console.log('     Enable: vector');
        } else if (cleanStatement.includes('CREATE TABLE')) {
          console.log('  ✅ Table creation statement prepared');
        } else if (cleanStatement.includes('CREATE INDEX')) {
          console.log('  ✅ Index creation statement prepared');
        } else if (cleanStatement.includes('CREATE FUNCTION') || cleanStatement.includes('CREATE OR REPLACE FUNCTION')) {
          console.log('  ✅ Function creation statement prepared');
        } else if (cleanStatement.includes('CREATE TRIGGER')) {
          console.log('  ✅ Trigger creation statement prepared');
        } else if (cleanStatement.includes('CREATE POLICY')) {
          console.log('  ✅ RLS policy creation statement prepared');
        } else if (cleanStatement.includes('ALTER TABLE')) {
          console.log('  ✅ Table alteration statement prepared');
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('⚠️  IMPORTANT: Database setup requires manual execution');
  console.log('='.repeat(50));
  console.log('\nSince Supabase JS client cannot execute raw DDL statements,');
  console.log('please complete the setup by:');
  console.log('\n1. Going to: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/sql/new');
  console.log('2. Copying the contents of setup-rag-database.sql');
  console.log('3. Pasting and running in the SQL Editor');
  console.log('\nThis will create all necessary tables, functions, and indexes.');
  console.log('\nAfter running the SQL, you can:');
  console.log('- Run: npm run seed-knowledge');
  console.log('- Run: npm run generate-embeddings');
  console.log('- Run: npm run test-rag');
}

runMigrations().catch(console.error);