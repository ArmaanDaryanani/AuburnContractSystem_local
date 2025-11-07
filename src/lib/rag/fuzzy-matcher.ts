/**
 * Fuzzy Text Matching with Fuse.js for Contract Clause Detection
 * Helps find approximate matches and extract exact spans
 */

import Fuse from 'fuse.js';

export interface FuzzyMatchResult {
  matched: boolean;
  exactText: string;
  startIndex: number;
  endIndex: number;
  score: number;
}

/**
 * Search for a clause in contract text using fuzzy matching
 * Returns exact span if found, or indicates missing clause
 */
export function fuzzySearchClause(
  contractText: string,
  searchPattern: string,
  threshold: number = 0.4
): FuzzyMatchResult {
  
  // Split contract into paragraphs for better matching
  const paragraphs = contractText.split(/\n\n+/).filter(p => p.trim().length > 20);
  
  // Use Fuse.js for fuzzy search
  const fuse = new Fuse(paragraphs, {
    includeScore: true,
    includeMatches: true,
    threshold,
    minMatchCharLength: 10,
    ignoreLocation: true,
    keys: ['']  // Search in the string itself
  });
  
  const results = fuse.search(searchPattern);
  
  // No match found → clause is missing
  if (results.length === 0 || !results[0].matches || results[0].score! > threshold) {
    return {
      matched: false,
      exactText: 'MISSING_CLAUSE',
      startIndex: -1,
      endIndex: -1,
      score: results[0]?.score || 1
    };
  }
  
  // Match found → extract exact span
  const bestMatch = results[0];
  const matchedParagraph = bestMatch.item;
  
  // Find the paragraph's position in original text
  const paragraphStart = contractText.indexOf(matchedParagraph);
  
  if (paragraphStart === -1) {
    return {
      matched: false,
      exactText: 'MISSING_CLAUSE',
      startIndex: -1,
      endIndex: -1,
      score: bestMatch.score!
    };
  }
  
  // Use regex to pin exact span within paragraph (word boundaries)
  const exactSpan = extractExactSpan(matchedParagraph, searchPattern);
  
  if (!exactSpan) {
    // Fallback: use the matched paragraph section
    const match = bestMatch.matches![0];
    const spanStart = paragraphStart + (match.indices[0][0] || 0);
    const spanEnd = paragraphStart + (match.indices[0][1] || matchedParagraph.length);
    
    return {
      matched: true,
      exactText: contractText.substring(spanStart, spanEnd + 1),
      startIndex: spanStart,
      endIndex: spanEnd + 1,
      score: bestMatch.score!
    };
  }
  
  return {
    matched: true,
    exactText: exactSpan.text,
    startIndex: paragraphStart + exactSpan.start,
    endIndex: paragraphStart + exactSpan.end,
    score: bestMatch.score!
  };
}

/**
 * Extract exact text span using regex with word boundaries
 */
export function extractExactSpan(
  text: string,
  pattern: string
): { text: string; start: number; end: number } | null {
  
  // Try exact match first
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  const exactIndex = lowerText.indexOf(lowerPattern);
  
  if (exactIndex !== -1) {
    return {
      text: text.substring(exactIndex, exactIndex + pattern.length),
      start: exactIndex,
      end: exactIndex + pattern.length
    };
  }
  
  // Try word-boundary regex
  const words = pattern.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return null;
  
  // Build regex with first 3 significant words
  const regexPattern = words.slice(0, 3).map(w => 
    w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('\\s+\\S*\\s+');
  
  try {
    const regex = new RegExp(regexPattern, 'i');
    const match = text.match(regex);
    
    if (match && match.index !== undefined) {
      // Extend match to include full sentence
      const sentenceMatch = extractFullSentence(text, match.index);
      return sentenceMatch || {
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      };
    }
  } catch (e) {
    // Regex failed, return null
  }
  
  return null;
}

/**
 * Extract full sentence containing the match
 */
function extractFullSentence(
  text: string,
  matchIndex: number
): { text: string; start: number; end: number } | null {
  
  // Find sentence boundaries
  const before = text.substring(0, matchIndex);
  const after = text.substring(matchIndex);
  
  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    0
  );
  
  const sentenceEndMatch = after.match(/[.!?]/);
  const sentenceEnd = sentenceEndMatch 
    ? matchIndex + sentenceEndMatch.index! + 1
    : text.length;
  
  const sentenceText = text.substring(
    sentenceStart === 0 ? 0 : sentenceStart + 1,
    sentenceEnd
  ).trim();
  
  return {
    text: sentenceText,
    start: sentenceStart === 0 ? 0 : sentenceStart + 1,
    end: sentenceEnd
  };
}

/**
 * Batch search multiple clauses
 */
export function batchFuzzySearch(
  contractText: string,
  patterns: string[],
  threshold: number = 0.4
): Map<string, FuzzyMatchResult> {
  
  const results = new Map<string, FuzzyMatchResult>();
  
  patterns.forEach(pattern => {
    const result = fuzzySearchClause(contractText, pattern, threshold);
    results.set(pattern, result);
  });
  
  return results;
}
