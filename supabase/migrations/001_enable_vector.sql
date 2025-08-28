-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;