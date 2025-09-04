"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Database,
  FileText,
  RefreshCw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminIngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("policy_matrix");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Auto-generate title from filename if empty
      if (!title) {
        const autoTitle = selectedFile.name
          .replace(/\.(xlsx|xls)$/i, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        setTitle(autoTitle);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title) {
      toast({
        title: "Missing information",
        description: "Please provide both a file and a title",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('documentType', documentType);

    try {
      const response = await fetch('/api/admin/ingest-xlsx', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: `Ingested ${result.chunksCreated} chunks from ${result.sheets?.length || 0} sheets`
        });
        
        setUploadedDocuments([...uploadedDocuments, {
          title,
          documentType,
          chunks: result.chunksCreated,
          sheets: result.sheets
        }]);
        
        // Reset form
        setFile(null);
        setTitle("");
      } else {
        toast({
          title: "Upload failed",
          description: result.error || "Failed to ingest document",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const documentTypes = [
    { value: 'far_matrix', label: 'FAR Compliance Matrix' },
    { value: 'contract_terms', label: 'Contract Terms & Alternatives' },
    { value: 'procurement_requirements', label: 'Procurement Requirements' },
    { value: 'vendor_compliance', label: 'Vendor Compliance Checklist' },
    { value: 'auburn_policy', label: 'Auburn Policy Document' },
    { value: 'policy_matrix', label: 'Policy Matrix' }
  ];

  const sampleDocuments = [
    { 
      name: 'FAR Matrix Auburn.xlsx',
      description: 'Federal Acquisition Regulation compliance matrix with Auburn-specific policies',
      type: 'far_matrix'
    },
    {
      name: 'Contract Terms Matrix.xlsx',
      description: 'Standard contract terms with approved Auburn alternative language',
      type: 'contract_terms'
    },
    {
      name: 'Procurement Requirements.xlsx',
      description: 'Procurement thresholds and approval requirements',
      type: 'procurement_requirements'
    },
    {
      name: 'Vendor Compliance.xlsx',
      description: 'Vendor compliance requirements and documentation checklist',
      type: 'vendor_compliance'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Document Ingestion Admin
          </h1>
          <p className="text-gray-600">
            Upload Auburn XLSX policy documents to the RAG system
          </p>
        </div>

        {/* Upload Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload XLSX Document
            </CardTitle>
            <CardDescription>
              Upload Auburn procurement and compliance spreadsheets for RAG processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* File Input */}
              <div>
                <Label htmlFor="file">Excel File (.xlsx)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="mt-1"
                />
                {file && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {/* Title Input */}
              <div>
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Auburn FAR Compliance Matrix"
                  disabled={isUploading}
                  className="mt-1"
                />
              </div>

              {/* Document Type Select */}
              <div>
                <Label htmlFor="type">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType} disabled={isUploading}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload Button */}
              <Button 
                onClick={handleUpload} 
                disabled={!file || !title || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Process
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Expected Documents */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Expected Auburn Documents
            </CardTitle>
            <CardDescription>
              These are the typical XLSX documents from Auburn Procurement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sampleDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-600">{doc.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Type: {doc.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Documents */}
        {uploadedDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Recently Uploaded Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploadedDocuments.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{doc.title}</p>
                      <p className="text-xs text-gray-600">
                        {doc.chunks} chunks • {doc.sheets?.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Obtain XLSX files from Auburn Procurement Services (pbshelp@auburn.edu)</li>
              <li>Upload each XLSX file with an appropriate title and document type</li>
              <li>The system will automatically parse sheets and generate embeddings</li>
              <li>Each row or semantic group becomes a searchable chunk in the RAG system</li>
              <li>After ingestion, contract analysis will use these documents for compliance checking</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}