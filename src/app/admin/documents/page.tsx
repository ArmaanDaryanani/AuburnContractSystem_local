"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Trash2, 
  FileText, 
  Database,
  RefreshCw,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileType
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/delete-documents');
      const data = await response.json();
      
      if (response.ok) {
        setDocuments(data.documents || []);
      } else {
        toast({
          title: "Error fetching documents",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedDocs.size === 0) {
      toast({
        title: "No documents selected",
        description: "Please select documents to delete",
        variant: "destructive"
      });
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocs)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Documents deleted",
          description: `Successfully deleted ${selectedDocs.size} document(s)`
        });
        setSelectedDocs(new Set());
        fetchDocuments();
      } else {
        toast({
          title: "Error deleting documents",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to delete documents",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteAll: true
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "All documents deleted",
          description: "Successfully deleted all documents and embeddings"
        });
        setSelectedDocs(new Set());
        fetchDocuments();
      } else {
        toast({
          title: "Error deleting documents",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to delete documents",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setShowDeleteAllDialog(false);
    }
  };

  const toggleDocSelection = (docId: string) => {
    const newSelection = new Set(selectedDocs);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocs(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)));
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    if (type?.includes('matrix') || type?.includes('xlsx')) {
      return <FileSpreadsheet className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'far_matrix': 'bg-blue-100 text-blue-800',
      'auburn_policy': 'bg-purple-100 text-purple-800',
      'contract_template': 'bg-green-100 text-green-800',
      'approved_alternative': 'bg-orange-100 text-orange-800',
      'policy_matrix': 'bg-indigo-100 text-indigo-800'
    };
    
    return (
      <Badge className={`${colors[type] || 'bg-gray-100 text-gray-800'} border-0`}>
        {type}
      </Badge>
    );
  };

  const totalEmbeddings = documents.reduce((sum, doc) => sum + (doc.embedding_count || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Document Management
          </h1>
          <p className="text-gray-600">
            Manage RAG system documents and embeddings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold">{documents.length}</p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Embeddings</p>
                  <p className="text-2xl font-bold">{totalEmbeddings.toLocaleString()}</p>
                </div>
                <FileType className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Selected</p>
                  <p className="text-2xl font-bold">{selectedDocs.size}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={fetchDocuments}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Link href="/admin/ingest">
                  <Button variant="outline">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Upload New
                  </Button>
                </Link>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={selectedDocs.size === 0 || deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected ({selectedDocs.size})
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteAllDialog(true)}
                  disabled={documents.length === 0 || deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              All documents currently in the RAG system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No documents found</p>
                <Link href="/admin/ingest">
                  <Button className="mt-4">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedDocs.size === documents.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4"
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Embeddings</TableHead>
                    <TableHead>File Type</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleDocSelection(doc.id)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getDocumentTypeIcon(doc.document_type)}
                          {doc.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getDocumentTypeBadge(doc.document_type)}
                      </TableCell>
                      <TableCell>{doc.embedding_count.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.metadata?.file_type || 'PDF'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete All Confirmation Dialog */}
        <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Documents?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {documents.length} documents and {totalEmbeddings.toLocaleString()} embeddings from the RAG system. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}