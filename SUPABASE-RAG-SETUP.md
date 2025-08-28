# 🚀 Supabase RAG Setup Guide

## Overview
This guide will help you set up the Retrieval-Augmented Generation (RAG) system for Auburn Contract Review using Supabase's vector database capabilities.

## Prerequisites
1. Supabase account (free tier works)
2. Your project's Supabase URL and API keys
3. OpenAI API key (optional, for real embeddings)

## Step 1: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here  # Optional but recommended

# Optional: OpenAI for embeddings
OPENAI_API_KEY=sk-...  # For generating real embeddings
```

To find your Supabase credentials:
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key
4. Copy the service_role key (keep this secret!)

## Step 2: Run Database Migrations

Since Supabase doesn't support running migrations via API with certain extensions, you need to run them manually:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:

### Migration 1: Enable Vector Extension
```sql
-- Copy contents from: supabase/migrations/001_enable_vector.sql
```

### Migration 2: Create Tables
```sql
-- Copy contents from: supabase/migrations/002_create_knowledge_tables.sql
```

### Migration 3: Create Search Functions
```sql
-- Copy contents from: supabase/migrations/003_create_search_functions.sql
```

**Important**: Run each migration completely before moving to the next one.

## Step 3: Seed Initial Knowledge Base

Run the seeding script to populate Auburn policies and FAR matrix:

```bash
npm run seed-knowledge
```

This will:
- Insert Auburn University policies
- Add FAR compliance matrix
- Load approved alternative language

## Step 4: Generate Embeddings

Generate vector embeddings for all documents:

```bash
npm run generate-embeddings
```

**Note**: Currently uses mock embeddings for testing. To use real embeddings:
1. Get an OpenAI API key
2. Update `generateEmbedding` function in `src/lib/rag/document-ingestion.ts`

## Step 5: Test the RAG System

Verify everything is working:

```bash
npm run test-rag
```

You should see:
- Similar documents being found
- Auburn policy context being retrieved
- Enhanced prompts being built

## Step 6: Update Contract Analysis

The system now has two analysis endpoints:

1. **Original endpoint**: `/api/contract/analyze` (no RAG)
2. **RAG-enhanced endpoint**: `/api/contract/analyze-rag` (with knowledge base)

To use RAG in your UI, update the API call in `contract-review-view.tsx`:

```typescript
// Change from:
const response = await fetch('/api/contract/analyze', ...)

// To:
const response = await fetch('/api/contract/analyze-rag', ...)
```

## What's Included

### Database Tables
- `knowledge_documents`: Stores policy documents
- `document_embeddings`: Vector embeddings for search
- `contracts`: Analyzed contracts
- `contract_analyses`: Analysis results
- `violations`: Specific violations found

### Search Functions
- `match_document_embeddings`: Find similar documents
- `get_auburn_policy_context`: Get relevant Auburn policies
- `search_far_violations`: Search FAR compliance issues
- `get_rag_context`: Get comprehensive context for analysis

### Knowledge Base Content
- 7 Auburn University core policies
- 4 FAR compliance requirements
- 5 Pre-approved alternative language templates

## How It Works

1. **Document Ingestion**: Policies are chunked and stored with embeddings
2. **Contract Analysis**: When analyzing a contract:
   - Contract text is embedded
   - Similar policies are retrieved via vector search
   - Context is added to the AI prompt
   - AI provides Auburn-specific analysis
3. **Results**: More accurate, policy-based recommendations

## Troubleshooting

### "pgvector extension not found"
- Make sure you enabled the extension in SQL Editor
- Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### "No embeddings found"
- Run `npm run generate-embeddings`
- Check Supabase logs for errors

### "Search returns no results"
- Verify data exists: Check Tables in Supabase Dashboard
- Ensure embeddings were generated
- Check function permissions in Supabase

## Next Steps

1. **Add Real Embeddings**: 
   - Sign up for OpenAI API
   - Update `generateEmbedding` function
   - Re-run `npm run generate-embeddings`

2. **Process Seed Documentation**:
   - Parse PDFs from `seed_documentation/`
   - Extract FAR matrix from team reports
   - Ingest historical contracts

3. **Enhance Search**:
   - Tune similarity thresholds
   - Add hybrid search (vector + keyword)
   - Implement result ranking

4. **Monitor Performance**:
   - Track query times
   - Monitor token usage
   - Optimize chunk sizes

## Cost Estimates

**Supabase Free Tier**:
- 500MB database ✅
- 1GB storage ✅
- 50,000 vector dimensions ✅
- Sufficient for MVP

**OpenAI Embeddings** (optional):
- ~$0.02 per 1M tokens
- Initial seed: ~$0.50
- Per contract: ~$0.001

## Support

For issues or questions:
1. Check Supabase logs: Dashboard → Logs
2. Test individual functions in SQL Editor
3. Verify environment variables are set
4. Review error messages in browser console

---

Your RAG system is now ready! The contract review system will provide Auburn-specific analysis based on real policies rather than generic AI responses.