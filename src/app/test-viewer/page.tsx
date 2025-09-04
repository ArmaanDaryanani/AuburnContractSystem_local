"use client";

import { useState } from "react";
import { DocumentViewer } from "@/components/document-viewer";
import { ViolationDetail } from "@/lib/contract-analysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function TestViewerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [violations] = useState<ViolationDetail[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      console.log('File selected:', selectedFile.name, selectedFile.type);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Document Viewer Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                id="file-upload"
                accept=".docx,.pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload">
                <Button asChild variant="outline">
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </span>
                </Button>
              </label>
            </div>
            
            {file && (
              <div className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentViewer
              file={file}
              violations={violations}
              onViolationClick={(id) => console.log('Violation clicked:', id)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}