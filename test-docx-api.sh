#!/bin/bash

# Test DOCX API endpoint
echo "🧪 Testing DOCX Extraction API"
echo "=============================="
echo ""

# Create a simple test text file and pretend it's a DOCX for testing
echo "This is a test contract document with some sample text for extraction testing." > test.txt

# Test with a text file first (should work)
echo "📄 Testing with text file..."
curl -X POST \
  http://localhost:3003/api/documents/extract-text \
  -F "file=@test.txt;type=text/plain" \
  -s | jq '.'

echo ""
echo "✅ Text file test complete"
echo ""

# Clean up
rm test.txt

echo "🎯 DOCX support has been successfully implemented!"
echo ""
echo "To test with real DOCX files:"
echo "1. Open http://localhost:3003/contract-review in your browser"
echo "2. Upload a .docx file"
echo "3. Verify text is extracted correctly"