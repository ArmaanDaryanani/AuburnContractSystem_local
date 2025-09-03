-- Migration: Create document annotations schema
-- Description: Tables for storing PDF and DOCX document highlights and annotations

-- Create document_annotations table
CREATE TABLE IF NOT EXISTS public.document_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('pdf', 'docx', 'txt')),
  annotation_type TEXT CHECK (annotation_type IN ('highlight', 'comment', 'violation')),
  text TEXT NOT NULL,
  serialized_range TEXT,
  position JSONB,
  page_number INTEGER,
  severity TEXT CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  color TEXT,
  comment TEXT,
  violation_id TEXT,
  far_reference TEXT,
  auburn_policy TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_annotations_document_id 
  ON document_annotations(document_id);

CREATE INDEX IF NOT EXISTS idx_document_annotations_user_id 
  ON document_annotations(user_id);

CREATE INDEX IF NOT EXISTS idx_document_annotations_created_at 
  ON document_annotations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_annotations_severity 
  ON document_annotations(severity);

CREATE INDEX IF NOT EXISTS idx_document_annotations_violation_id 
  ON document_annotations(violation_id);

-- Enable Row Level Security
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now, can be refined later)
CREATE POLICY "Allow public read access" ON document_annotations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON document_annotations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON document_annotations
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON document_annotations
  FOR DELETE USING (true);

-- Create annotation_collaborators table for shared annotations
CREATE TABLE IF NOT EXISTS public.annotation_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID REFERENCES document_annotations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission TEXT CHECK (permission IN ('view', 'edit', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- Create index for collaborators
CREATE INDEX IF NOT EXISTS idx_annotation_collaborators_annotation_id 
  ON annotation_collaborators(annotation_id);

CREATE INDEX IF NOT EXISTS idx_annotation_collaborators_user_id 
  ON annotation_collaborators(user_id);

-- Enable RLS on collaborators
ALTER TABLE annotation_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS policies for collaborators
CREATE POLICY "Allow public read collaborators" ON annotation_collaborators
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert collaborators" ON annotation_collaborators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update collaborators" ON annotation_collaborators
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete collaborators" ON annotation_collaborators
  FOR DELETE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_document_annotations_updated_at 
  BEFORE UPDATE ON document_annotations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for annotations with collaborators
CREATE OR REPLACE VIEW annotations_with_collaborators AS
SELECT 
  da.*,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'user_id', ac.user_id,
        'permission', ac.permission
      )
    ) FILTER (WHERE ac.id IS NOT NULL),
    '[]'::json
  ) as collaborators
FROM document_annotations da
LEFT JOIN annotation_collaborators ac ON da.id = ac.annotation_id
GROUP BY da.id;