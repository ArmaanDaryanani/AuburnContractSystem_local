import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/supabase/migrations/001_create_annotations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');
    
    console.log('🚀 Initializing annotations database schema...');
    
    const results = [];
    const errors = [];
    
    // Execute each statement
    for (const statement of statements) {
      // Skip comments
      if (statement.startsWith('--')) continue;
      
      try {
        // For DDL statements, we need to use raw SQL
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('document_annotations')
            .select('id')
            .limit(1);
          
          if (!directError || directError.code === '42P01') {
            // Table doesn't exist, which is expected
            errors.push({
              statement: statement.substring(0, 50) + '...',
              error: error.message
            });
          }
        } else {
          results.push({
            statement: statement.substring(0, 50) + '...',
            status: 'success'
          });
        }
      } catch (err: any) {
        errors.push({
          statement: statement.substring(0, 50) + '...',
          error: err.message
        });
      }
    }
    
    // Test if the table exists
    const { data: testData, error: testError } = await supabase
      .from('document_annotations')
      .select('count')
      .limit(1);
    
    const tableExists = !testError || testError.code !== '42P01';
    
    return NextResponse.json({
      success: true,
      message: 'Annotations schema initialization attempted',
      tableExists,
      results,
      errors,
      note: errors.length > 0 
        ? 'Some statements failed. The table may already exist or require manual creation in Supabase dashboard.'
        : 'All statements executed successfully'
    });
  } catch (error: any) {
    console.error('Error initializing annotations schema:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize annotations schema',
        details: error.message,
        suggestion: 'Please create the tables manually in Supabase dashboard using the SQL in src/lib/supabase/migrations/001_create_annotations.sql'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Alternative method: Create basic table structure
  try {
    // Test if table exists first
    const { error: checkError } = await supabase
      .from('document_annotations')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') {
      // Table doesn't exist - provide instructions
      return NextResponse.json({
        success: false,
        message: 'Table does not exist',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to SQL Editor',
          '3. Copy and run the SQL from src/lib/supabase/migrations/001_create_annotations.sql',
          '4. The table will be created with all necessary indexes and policies'
        ],
        sqlPath: 'src/lib/supabase/migrations/001_create_annotations.sql'
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Annotations table already exists'
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to check annotations table',
        details: error.message
      },
      { status: 500 }
    );
  }
}