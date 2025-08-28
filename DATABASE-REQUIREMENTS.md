# Database Requirements for Auburn Contract Review System

## 🗄️ Database Schema Requirements

### Core Tables Needed

#### 1. **users** (Authentication & User Management)
```sql
- id (UUID, primary key)
- email (varchar, unique)
- name (varchar)
- role (enum: 'admin', 'reviewer', 'auditor', 'viewer')
- department (varchar)
- created_at (timestamp)
- updated_at (timestamp)
- last_login (timestamp)
```

#### 2. **contracts** (Contract Storage)
```sql
- id (UUID, primary key)
- title (varchar)
- file_url (text) - S3/Storage URL
- file_hash (varchar) - For duplicate detection
- contract_text (text) - Extracted text
- contract_type (enum: 'purchase', 'service', 'license', 'nda', 'other')
- vendor_name (varchar)
- contract_value (decimal)
- start_date (date)
- end_date (date)
- status (enum: 'draft', 'under_review', 'approved', 'rejected', 'expired')
- uploaded_by (UUID, foreign key to users)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 3. **contract_analyses** (Analysis Results)
```sql
- id (UUID, primary key)
- contract_id (UUID, foreign key to contracts)
- analysis_type (enum: 'far', 'auburn', 'ai', 'manual')
- confidence_score (decimal)
- risk_score (decimal)
- compliance_status (enum: 'compliant', 'violations_found', 'needs_review')
- total_violations (integer)
- critical_violations (integer)
- processing_time_ms (integer)
- ai_model_used (varchar)
- analyzed_by (UUID, foreign key to users)
- created_at (timestamp)
```

#### 4. **violations** (Compliance Violations)
```sql
- id (UUID, primary key)
- analysis_id (UUID, foreign key to contract_analyses)
- contract_id (UUID, foreign key to contracts)
- violation_type (varchar) - e.g., 'FAR 28.106'
- severity (enum: 'critical', 'high', 'medium', 'low')
- description (text)
- clause_text (text) - The problematic clause
- location (json) - Line/page numbers
- far_reference (varchar)
- suggested_language (text)
- resolution_status (enum: 'open', 'resolved', 'accepted', 'waived')
- resolved_by (UUID, foreign key to users)
- resolution_notes (text)
- created_at (timestamp)
- resolved_at (timestamp)
```

#### 5. **batch_audits** (Batch Processing)
```sql
- id (UUID, primary key)
- batch_name (varchar)
- total_contracts (integer)
- processed_contracts (integer)
- status (enum: 'pending', 'processing', 'completed', 'failed')
- started_at (timestamp)
- completed_at (timestamp)
- created_by (UUID, foreign key to users)
- summary_report (json)
```

#### 6. **batch_audit_contracts** (Batch-Contract Relationship)
```sql
- id (UUID, primary key)
- batch_id (UUID, foreign key to batch_audits)
- contract_id (UUID, foreign key to contracts)
- processing_status (enum: 'pending', 'processing', 'completed', 'failed')
- error_message (text)
- processed_at (timestamp)
```

#### 7. **knowledge_base** (Document Templates & Resources)
```sql
- id (UUID, primary key)
- title (varchar)
- category (enum: 'template', 'policy', 'guideline', 'alternative_language')
- content (text)
- file_url (text)
- tags (json array)
- is_active (boolean)
- created_by (UUID, foreign key to users)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 8. **audit_logs** (Activity Tracking)
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to users)
- action (varchar) - e.g., 'contract.upload', 'analysis.run'
- resource_type (varchar)
- resource_id (UUID)
- details (json)
- ip_address (inet)
- user_agent (text)
- created_at (timestamp)
```

#### 9. **system_metrics** (Performance Tracking)
```sql
- id (UUID, primary key)
- metric_type (varchar) - e.g., 'daily_contracts', 'avg_processing_time'
- metric_value (decimal)
- metric_date (date)
- metadata (json)
- created_at (timestamp)
```

### Vector Database Requirements (for RAG/Search)

#### **contract_embeddings** (Pinecone/pgvector)
```
- id (UUID)
- contract_id (UUID)
- chunk_text (text)
- embedding (vector[1536]) - OpenAI embedding dimension
- metadata (json) - contract metadata for filtering
```

## 🛠️ Recommended Tech Stack

### Option 1: Supabase (Recommended for MVP)
**Pros:**
- Built-in authentication
- Real-time subscriptions
- PostgreSQL with pgvector for embeddings
- Row-level security
- Auto-generated APIs
- File storage included
- Free tier generous (500MB database, 1GB storage)

**Implementation:**
```javascript
// Example Supabase integration
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Upload contract
const { data, error } = await supabase
  .storage
  .from('contracts')
  .upload(`contracts/${file.name}`, file)

// Save analysis
const { data, error } = await supabase
  .from('contract_analyses')
  .insert({
    contract_id: contractId,
    confidence_score: 0.85,
    violations: violations
  })
```

### Option 2: Vercel Postgres + Blob Storage
**Pros:**
- Seamless Vercel integration
- Edge function support
- Built for Next.js
- Automatic connection pooling

### Option 3: PlanetScale (MySQL)
**Pros:**
- Serverless MySQL
- Branching for database schemas
- Automatic backups
- Great for scaling

## 📊 Data Flow Implementation

### 1. Contract Upload Flow
```
User uploads → Store file in S3/Blob → Extract text → 
Save to contracts table → Create embeddings → 
Store in vector DB → Return contract ID
```

### 2. Analysis Flow
```
Retrieve contract → Run TF-IDF analysis → 
Query vector DB for similar violations → 
Stream AI analysis → Save results to contract_analyses → 
Save violations → Update metrics → Return results
```

### 3. Batch Audit Flow
```
Create batch_audit record → Queue contracts → 
Process each contract → Update batch_audit_contracts → 
Generate summary report → Update batch status
```

## 🔒 Security Requirements

1. **Row-Level Security (RLS)**
   - Users can only see contracts from their department
   - Admins have full access
   - Reviewers can edit, viewers read-only

2. **Encryption**
   - Encrypt sensitive contract data at rest
   - Use SSL/TLS for all connections
   - Encrypt file storage

3. **Audit Trail**
   - Log all contract access
   - Track all modifications
   - Compliance reporting

## 🚀 Implementation Priority

### Phase 1 (MVP - Immediate)
```env
# Add to .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

**Tables to create first:**
1. contracts
2. contract_analyses
3. violations
4. users (use Supabase Auth)

### Phase 2 (Week 2)
- batch_audits
- batch_audit_contracts
- audit_logs
- contract_embeddings (with pgvector)

### Phase 3 (Week 3)
- knowledge_base
- system_metrics
- Advanced search with embeddings

## 📝 Sample Supabase Migration

```sql
-- Create contracts table
CREATE TABLE contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_url TEXT,
  contract_text TEXT,
  vendor_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create violations table
CREATE TABLE violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  violation_type VARCHAR(100),
  severity VARCHAR(20),
  description TEXT,
  suggested_language TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own contracts" ON contracts
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert their own contracts" ON contracts
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
```

## 🔗 Next Steps

1. **Set up Supabase account** (free tier)
2. **Run migrations** to create tables
3. **Update API routes** to use Supabase client
4. **Implement file upload** to Supabase Storage
5. **Add authentication** with Supabase Auth
6. **Create real-time subscriptions** for batch processing

This will make all UI elements functional and provide persistent storage for the Auburn Contract Review System.