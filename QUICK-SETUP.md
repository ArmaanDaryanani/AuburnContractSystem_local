# 🚀 Quick RAG Setup Instructions

## Step 1: Get Your Supabase API Keys

1. Go to: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/settings/api
2. Copy these keys:
   - **Project URL**: `https://gyyzbirasglwrythivgw.supabase.co`
   - **anon public key**: (starts with `eyJ...`)
   - **service_role key**: (starts with `eyJ...`) - KEEP SECRET!

## Step 2: Update Your .env.local

Add the keys you just copied:
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
```

## Step 3: Run Database Setup

1. Go to: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/sql/new
2. Copy ALL contents from `setup-rag-database.sql`
3. Paste in SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. You should see success messages

## Step 4: Seed Knowledge Base

Run in terminal:
```bash
npm run seed-knowledge
```

This will populate:
- Auburn University policies
- FAR compliance matrix
- Pre-approved alternative language

## Step 5: Generate Embeddings

```bash
npm run generate-embeddings
```

## Step 6: Test the System

```bash
npm run test-rag
```

## Step 7: Use RAG in Your App

The system is now ready! Your contract analysis will automatically use the knowledge base.

To verify it's working:
1. Upload a test contract
2. Check the console for "RAG-enhanced analysis" messages
3. Results should reference specific Auburn policies

## Troubleshooting

If you see errors:
1. Check all .env.local variables are set
2. Verify database tables exist in Supabase Table Editor
3. Run `npm run test-rag` to debug

## Your Project Links

- **Dashboard**: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw
- **SQL Editor**: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/sql/new
- **Table Editor**: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/editor
- **API Settings**: https://supabase.com/dashboard/project/gyyzbirasglwrythivgw/settings/api