# Quick Start Guide - AI Contract Review

## 🚀 30-Second Test

```bash
# 1. Start the app
npm run dev

# 2. Open browser
http://localhost:3006

# 3. Upload test contract
tests/golden-contract.txt

# 4. Click "Analyze Contract"

# 5. Expected: 7-8 violations detected
```

---

## ✅ What to Look For

### Success Indicators:
- ✅ **7-8 violations** detected from golden contract
- ✅ **3 CRITICAL** issues (Indemnification, IP Rights, Insurance/Arbitration)
- ✅ **Highlighting works** (DOCX/TXT only for now)
- ✅ **Clicking violations** scrolls to problematic text
- ✅ **Two sidebar sections**: Missing Clauses (amber) + Problematic Language (red)

### Expected Violations:

| # | Category | Severity | Problematic Text |
|---|----------|----------|------------------|
| 1 | Payment | HIGH | "sixty (60) days", "receiving payment from federal" |
| 2 | IP Rights | CRITICAL | "shall be sole property of Sponsor" |
| 3 | Indemnification | CRITICAL | "Auburn agrees to indemnify" |
| 4 | Insurance | HIGH | "commercial general liability insurance" |
| 5 | Arbitration | HIGH | "binding arbitration" |
| 6 | Equipment | MEDIUM | "vest with Sponsor" |
| 7 | Publication | HIGH | "prior written approval", "90 days" |
| 8 | Termination | MEDIUM | Missing "termination for convenience" |

---

## 🔍 How FAR Comparison Works

### Simple Explanation:

1. **Load Rules** from 30 CSV files (FAR Matrix + Auburn T&Cs)
   ```
   data/policy/2023-03-20_FARMatrix_FAR.csv
   data/policy/ContractTs&CsMatrix_DisputeResolution.csv
   ... (28 more files)
   ```

2. **AI finds clause types** using MobileBERT
   ```
   "In the event of any dispute... binding arbitration"
   → AI detects: "dispute resolution" (92% confidence)
   ```

3. **Fuzzy match finds exact text**
   ```
   Search for: "binding arbitration"
   Found: "parties agree to submit to binding arbitration"
   Score: 0.22 (good match, threshold is 0.35)
   ```

4. **Apply Auburn rule**
   ```
   Rule: DisputeResolution
   - Prohibited: ["binding arbitration", "mandatory arbitration"]
   - Risk: HIGH
   - Reason: "Auburn has sovereign immunity"
   
   → Generate violation with exact span
   ```

### FAR CSV Structure Example:

```csv
Clause,Title,Acceptance Status,Criteria,Request to Sponsor
52.203-7,Anti-Kickback,C,"If over SAT","Required for $150k+"
52.XXX-X,Indemnification,REMOVE,"Never accept","Auburn cannot indemnify"
```

**Acceptance Status**:
- `OK` = Always fine → Skip
- `REMOVE` = Never accept → Flag as HIGH/CRITICAL
- `C` = Conditional → Check criteria field

### Auburn T&C CSV Structure:

```csv
Category,Preferred Language,Common Problems
DisputeResolution,"mediation (non-binding)","binding arbitration|mandatory arbitration"
Payment,"NET 30 days","60 days|90 days|upon receiving payment"
```

**Processing**:
- `Preferred Language` → What SHOULD be there (if missing → violation)
- `Common Problems` → What should NOT be there (if found → violation)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `data/policy/*.csv` | 30 CSV files with FAR/Auburn rules |
| `src/lib/policy/load-far.ts` | Parses FAR CSVs into rule objects |
| `src/lib/policy/load-tnc.ts` | Parses Auburn T&C CSVs |
| `src/lib/ai/clause-finder.ts` | AI clause detection (Transformers.js) |
| `src/lib/detect/run-detections.ts` | Main detection pipeline |
| `src/lib/rag/fuzzy-matcher.ts` | Fuse.js fuzzy matching |
| `tests/golden-contract.txt` | Test contract with 8 violations |
| `tests/expected-violations.json` | Expected results |

---

## 🎯 Testing Checklist

### Basic Functionality
- [ ] Upload `tests/golden-contract.txt`
- [ ] Click "Analyze Contract"
- [ ] See 7-8 violations detected
- [ ] Verify 3 CRITICAL severity issues
- [ ] Click a violation card → text highlights
- [ ] See two sidebar sections (Missing + Problematic)

### Document Types
- [ ] TXT file → Text highlighting works
- [ ] DOCX file → Formatted highlighting works
- [ ] PDF file → Shows violation count (advanced highlighting pending)

### Accuracy Check
- [ ] Compare results to `tests/expected-violations.json`
- [ ] All 8 violation categories detected
- [ ] Each has correct severity level
- [ ] Problematic text extracted accurately

### Edge Cases
- [ ] Upload clean contract → 0 violations + confetti
- [ ] Upload very large contract (50+ pages) → Still works
- [ ] Upload scanned PDF → OCR fallback activates

---

## 🐛 Common Issues & Fixes

### "No violations detected"
```bash
# Check FAR files loaded
ls -l data/policy/
# Should see 30 CSV files

# Check browser console
# Open DevTools → Console tab
# Look for errors from clause-finder.ts or load-far.ts
```

### "Analysis takes >30 seconds"
```javascript
// First run downloads AI model (~25MB)
// Check Network tab in DevTools
// Look for: mobilebert-uncased-mnli model download
```

### "Highlighting doesn't work"
```javascript
// Only works for DOCX/TXT, not PDF yet
// Check that violation.exactText exists
// Should NOT be 'MISSING_CLAUSE'
```

---

## 🔧 Adjusting Settings

### Make detection MORE strict (fewer false positives):
```typescript
// src/lib/detect/run-detections.ts
const detections = await runDetections(text, {
  useAI: true,
  minConfidence: 0.5,      // Raise from 0.3
  fuzzyThreshold: 0.25,    // Lower from 0.35
});
```

### Make detection LESS strict (catch more issues):
```typescript
const detections = await runDetections(text, {
  useAI: true,
  minConfidence: 0.2,      // Lower from 0.3
  fuzzyThreshold: 0.45,    // Raise from 0.35
});
```

---

## 📊 How It Compares to Requirements

**Professor's Requirements** → **Our Implementation**:

✅ "AI tool to assist contract negotiators"
→ Transformers.js zero-shot classification + Fuse.js fuzzy matching

✅ "Identify and flag legal and technical issues"
→ 8 violation types detected in test contract

✅ "Suggest potential revisions"
→ Every violation shows Auburn's preferred language

✅ "Scan for words, phrases, sentences"
→ Fuzzy matching catches variations, not just exact text

✅ "FAR compliance checking"
→ 20 FAR Matrix CSVs parsed (100+ rules)

✅ "Auburn policy enforcement"
→ 10 Auburn T&C CSVs parsed

✅ "Works with Microsoft Word, Adobe PDF"
→ Supports DOCX, PDF, TXT

✅ "Improve user interface"
→ Clean sidebar with click-to-scroll highlighting

---

## 📖 More Documentation

- **Technical Deep Dive**: `HOW_IT_WORKS.md`
- **User Guide**: `USER_GUIDE.md`
- **Test Data**: `tests/expected-violations.json`

---

**Ready to test? Run the 30-second test at the top! 🚀**
