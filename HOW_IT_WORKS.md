# How the AI Contract Review System Works

## Overview
The system uses a **3-stage hybrid approach** to detect contract violations:

```
Contract Upload → AI Clause Detection → Fuzzy Matching → FAR/Auburn Rule Application → Violations
```

---

## Stage 1: AI Clause Detection (Transformers.js)

**File**: `src/lib/ai/clause-finder.ts`

### What It Does:
- Uses MobileBERT zero-shot classification model
- Splits contract into paragraphs (50+ chars)
- Classifies each paragraph into clause types:
  - Dispute Resolution, Arbitration, Termination
  - Indemnification, Liability, Equipment
  - Personnel, Confidentiality, IP, Payment, etc.

### Example:
```javascript
Input paragraph: "Either party may terminate this agreement with 30 days notice."
AI Output: { type: "termination", confidence: 0.92, text: "..." }
```

### Why This Matters:
- Semantic understanding (not just keywords)
- Catches variations: "binding arbitration", "mandatory arbitration", "final arbitration"
- Understands context and negations

---

## Stage 2: FAR & Auburn Policy Loading

**Files**: 
- `src/lib/policy/load-far.ts` - Parses 20 FAR Matrix CSVs
- `src/lib/policy/load-tnc.ts` - Parses 10 Auburn T&C CSVs

### FAR Matrix Structure (from CSV):
```csv
Clause, Title, Date, Acceptance Status, Criteria, Request to Sponsor
52.203-7, Anti-Kickback, Jun 2020, C, "If over SAT", "Required for contracts >$150k"
52.203-X, Indemnification, ..., REMOVE, "Never accept", "Auburn cannot indemnify"
```

### Parsing Logic:
1. **Skip "OK" clauses** - Always acceptable, no violation
2. **Flag "REMOVE" clauses** - Never acceptable (HIGH/CRITICAL risk)
3. **Evaluate "C" (Conditional)** - Check criteria field

### Auburn T&C Structure:
```csv
Category, Preferred Language, Common Problems, Why, Response
DisputeResolution, "mediation not arbitration", "binding arbitration", "sovereign immunity", "Remove binding language"
```

### Rule Generation:
```typescript
{
  id: "AUBURN-DisputeResolution",
  source: "AUBURN",
  category: "DisputeResolution",
  requirementText: "mediation not arbitration",
  prohibitedPatterns: ["binding arbitration", "mandatory arbitration"],
  risk: "HIGH"
}
```

---

## Stage 3: Detection Pipeline

**File**: `src/lib/detect/run-detections.ts`

### Algorithm:

#### Step 1: Load All Rules
```javascript
const farRules = await loadFARRules();      // ~100 FAR clause rules
const auburnRules = await loadAuburnTnCRules(); // ~10 Auburn T&C rules
```

#### Step 2: AI Clause Finding (Optional)
```javascript
const aiCandidates = await findClauses(contractText, 0.3);
// Returns: [{ type: "arbitration", text: "...", confidence: 0.85 }]
```

#### Step 3: For Each Rule - Check Prohibited Patterns
```javascript
for (const rule of allRules) {
  if (rule.prohibitedPatterns) {  // e.g., ["binding arbitration"]
    for (const pattern of rule.prohibitedPatterns) {
      
      // Fuzzy search with Fuse.js
      const fuzzyMatch = fuzzySearchClause(contractText, pattern, 0.35);
      
      if (fuzzyMatch.matched) {
        // Found problematic text!
        detections.push({
          type: 'PROBLEMATIC_TEXT',
          severity: rule.risk,
          exactText: fuzzyMatch.exactText,  // "parties agree to binding arbitration"
          startIndex: fuzzyMatch.startIndex,
          endIndex: fuzzyMatch.endIndex,
          explanation: rule.requestToSponsor,
          preferredLanguage: rule.requirementText
        });
      }
    }
  }
}
```

#### Step 4: For Each Rule - Check Missing Requirements
```javascript
if (rule.requirementText && rule.risk >= 'HIGH') {
  const fuzzyMatch = fuzzySearchClause(contractText, rule.requirementText, 0.35);
  
  if (!fuzzyMatch.matched) {
    // Required clause is MISSING!
    detections.push({
      type: 'MISSING_CLAUSE',
      severity: rule.risk,
      category: rule.category,
      explanation: `Missing required ${rule.category} clause`,
      preferredLanguage: rule.requirementText  // What should be there
    });
  }
}
```

#### Step 5: AI-Enhanced Detection (if enabled)
```javascript
// For each AI-detected clause
for (const aiCandidate of aiCandidates) {
  const relevantRules = allRules.filter(r => 
    r.category.includes(aiCandidate.type)
  );
  
  // Search within the AI-identified paragraph
  const paragraphMatch = fuzzySearchClause(aiCandidate.text, pattern, 0.35);
  
  if (paragraphMatch.matched) {
    // AI found the clause type, fuzzy matcher found exact violation
  }
}
```

---

## Stage 4: Fuzzy Matching (Exact Span Extraction)

**File**: `src/lib/rag/fuzzy-matcher.ts`

### Why Fuzzy Matching?
Contracts use varied wording:
- "binding arbitration"
- "final and binding arbitration"
- "parties shall submit to arbitration which shall be binding"

### Fuse.js Algorithm:
```javascript
// Split contract into paragraphs
const paragraphs = contractText.split(/\n\n+/);

// Configure Fuse.js
const fuse = new Fuse(paragraphs, {
  threshold: 0.35,          // 0 = exact, 1 = match anything
  includeMatches: true,     // Get exact character positions
  ignoreLocation: true,     // Search entire paragraph
});

// Search
const results = fuse.search("binding arbitration");

// Result:
{
  item: "The parties agree to final and binding arbitration...",
  score: 0.28,  // Good match!
  matches: [{ indices: [[35, 54]] }]  // Character positions
}
```

### Span Extraction:
```javascript
// Extract exact sentence containing the match
const exactSpan = extractFullSentence(paragraph, matchIndex);
// Returns: "The parties agree to final and binding arbitration for all disputes."
```

---

## Complete Example Walkthrough

### Input Contract:
```
DISPUTE RESOLUTION

In the event of any dispute arising from this Agreement, 
the parties agree to submit to binding arbitration in 
accordance with the rules of the American Arbitration Association.

PAYMENT TERMS

Auburn shall pay Sponsor within 60 days of receiving 
payment from the federal funding agency.
```

### Detection Process:

#### 1. AI Clause Detection:
```javascript
aiCandidates = [
  { type: "dispute resolution", text: "In the event of any dispute...", confidence: 0.92 },
  { type: "payment terms", text: "Auburn shall pay...", confidence: 0.88 }
]
```

#### 2. Load Auburn Rules:
```javascript
{
  id: "AUBURN-DisputeResolution",
  prohibitedPatterns: ["binding arbitration", "mandatory arbitration"],
  requirementText: "mediation (non-binding)",
  risk: "HIGH"
},
{
  id: "AUBURN-Payment",
  prohibitedPatterns: ["60 days", "90 days", "upon receiving payment"],
  requirementText: "NET 30 days",
  risk: "HIGH"
}
```

#### 3. Fuzzy Match Prohibited Patterns:
```javascript
// Search for "binding arbitration"
fuzzySearchClause(contractText, "binding arbitration", 0.35)
→ {
    matched: true,
    exactText: "the parties agree to submit to binding arbitration",
    startIndex: 125,
    endIndex: 175,
    score: 0.22
  }

// Search for "60 days"
fuzzySearchClause(contractText, "60 days", 0.35)
→ {
    matched: true,
    exactText: "Auburn shall pay Sponsor within 60 days",
    startIndex: 285,
    endIndex: 325,
    score: 0.05  // Exact match
  }
```

#### 4. Generate Violations:
```javascript
violations = [
  {
    id: "AUBURN-DisputeResolution-1",
    type: "PROBLEMATIC_TEXT",
    severity: "HIGH",
    category: "DisputeResolution",
    exactText: "the parties agree to submit to binding arbitration",
    startIndex: 125,
    endIndex: 175,
    explanation: "Auburn has sovereign immunity and cannot agree to binding arbitration",
    preferredLanguage: "mediation (non-binding)",
    confidence: 0.78
  },
  {
    id: "AUBURN-Payment-1",
    type: "PROBLEMATIC_TEXT",
    severity: "HIGH",
    category: "Payment",
    exactText: "Auburn shall pay Sponsor within 60 days",
    startIndex: 285,
    endIndex: 325,
    explanation: "Auburn requires NET 30 payment terms, not contingent on receiving funds",
    preferredLanguage: "NET 30 days from receipt of invoice",
    confidence: 0.95
  }
]
```

#### 5. UI Display:
- **DOCX**: mark.js highlights the exact spans with red underlining
- **PDF**: Shows count in banner (advanced highlighting pending)
- **Sidebar**: Two sections:
  - "Missing Required Clauses" (amber) - Non-clickable, shows what's missing
  - "Problematic Language" (red) - Clickable, scrolls to highlight

---

## Key Advantages Over Pattern Matching

### 1. Semantic Understanding
❌ **Pattern Matching**: Only finds "indemnif"
✅ **AI + Fuzzy**: Finds "hold harmless", "defend and indemnify", "shall indemnify and hold harmless"

### 2. Context Awareness
❌ **Pattern Matching**: Flags "shall NOT provide indemnification"
✅ **AI + Fuzzy**: Understands negation, doesn't flag

### 3. Wording Variations
❌ **Pattern Matching**: Misses "mandatory and final arbitration"
✅ **AI + Fuzzy**: Threshold 0.35 catches variations

### 4. Exact Span Extraction
❌ **Pattern Matching**: Highlights entire paragraph
✅ **Fuzzy Matcher**: Extracts exact problematic sentence

---

## Configuration

### Thresholds:
- **AI Confidence**: 0.3 (30% confidence to consider a clause type)
- **Fuzzy Threshold**: 0.35 (lower = stricter matching)

### Adjusting Sensitivity:
```typescript
// In src/lib/detect/run-detections.ts
const detections = await runDetections(text, {
  useAI: true,           // Enable AI clause detection
  minConfidence: 0.3,    // Lower = more clause candidates
  fuzzyThreshold: 0.35,  // Lower = stricter pattern matching
});
```

---

## Performance

- **FAR Rules**: ~100 rules loaded from 20 CSV files
- **Auburn Rules**: ~10 rules from 10 CSV files
- **AI Model**: MobileBERT (~25MB download, cached in browser)
- **Detection Time**: ~2-5 seconds for typical contract (10-50 pages)

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/ai/clause-finder.ts` | Transformers.js zero-shot classifier |
| `src/lib/policy/load-far.ts` | Parse FAR Matrix CSVs into rules |
| `src/lib/policy/load-tnc.ts` | Parse Auburn T&C CSVs into rules |
| `src/lib/detect/run-detections.ts` | Main detection pipeline |
| `src/lib/rag/fuzzy-matcher.ts` | Fuse.js fuzzy matching + span extraction |
| `data/policy/*.csv` | 30 CSV files with FAR & Auburn policies |
| `src/app/api/contract/analyze/route.ts` | API endpoint using detection system |
