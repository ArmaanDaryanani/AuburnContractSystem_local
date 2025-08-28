#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function setupSearchFunctions() {
  console.log('🔧 Setting up RAG search functions in Supabase...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-rag-functions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 Executing SQL to create search functions...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    }).single();
    
    if (error) {
      // If RPC doesn't exist, provide manual instructions
      console.log('\n⚠️  Automatic setup not available. Please run this SQL manually in Supabase:\n');
      console.log('1. Go to: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/sql/new');
      console.log('2. Copy and paste the contents of: scripts/create-rag-functions.sql');
      console.log('3. Click "Run"\n');
      
      console.log('📋 SQL Preview:\n');
      console.log(sql.substring(0, 500) + '...\n');
      
      return;
    }
    
    console.log('✅ Search functions created successfully!');
    
    // Test the functions
    console.log('\n🧪 Testing search functions...');
    
    const { data: farTest, error: farError } = await supabase
      .rpc('search_far_violations', {
        query_text: 'payment',
        match_count: 1
      });
    
    if (!farError) {
      console.log('✅ FAR search function works!');
    } else {
      console.log('⚠️  FAR search needs manual setup:', farError.message);
    }
    
    const { data: auburnTest, error: auburnError } = await supabase
      .rpc('search_auburn_policies', {
        query_text: 'indemnification',
        match_count: 1
      });
    
    if (!auburnError) {
      console.log('✅ Auburn policy search function works!');
    } else {
      console.log('⚠️  Auburn search needs manual setup:', auburnError.message);
    }
    
    console.log('\n✨ RAG search functions are ready!');
    console.log('💡 Test with: npm run test-rag-search\n');
    
  } catch (error) {
    console.error('❌ Error setting up search functions:', error);
    console.log('\nPlease manually run the SQL in Supabase dashboard:');
    console.log('File: scripts/create-rag-functions.sql');
  }
}

setupSearchFunctions().catch(console.error);