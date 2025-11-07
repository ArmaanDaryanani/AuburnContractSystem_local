import { PolicyRule, AuburnTnC, RiskLevel } from './types';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

export async function loadAuburnTnCRules(): Promise<PolicyRule[]> {
  const rules: PolicyRule[] = [];
  const policyDir = path.join(process.cwd(), 'data', 'policy');
  
  const tncFiles = fs.readdirSync(policyDir).filter(f => 
    f.startsWith('ContractTs&CsMatrix_') && f.endsWith('.csv')
  );

  for (const file of tncFiles) {
    const filePath = path.join(policyDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const records = parse(content, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    const category = file.replace('ContractTs&CsMatrix_', '').replace('.csv', '');

    let preferredLanguage = '';
    const prohibitedPatterns: string[] = [];
    const responses: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      
      if (row[0]?.includes("Auburn's Preferred Language") && i + 1 < records.length) {
        preferredLanguage = records[i + 1][0] || '';
        continue;
      }

      if (row[0] === 'Common Problems' && row[1] === 'Why') {
        for (let j = i + 1; j < records.length; j++) {
          const problemRow = records[j];
          if (problemRow[0] && problemRow[0].trim() !== '') {
            prohibitedPatterns.push(problemRow[0].toLowerCase().trim());
            if (problemRow[2]) responses.push(problemRow[2]);
          }
        }
        break;
      }
    }

    let risk: RiskLevel = 'MEDIUM';
    if (category.toLowerCase().includes('dispute') || 
        category.toLowerCase().includes('termination') ||
        category.toLowerCase().includes('indemnif')) {
      risk = 'HIGH';
    }
    if (preferredLanguage.toLowerCase().includes('shall not') ||
        preferredLanguage.toLowerCase().includes('prohibited')) {
      risk = 'CRITICAL';
    }

    if (prohibitedPatterns.length > 0 || preferredLanguage) {
      rules.push({
        id: `AUBURN-${category}`,
        source: 'AUBURN',
        category,
        requirementText: preferredLanguage,
        prohibitedPatterns: prohibitedPatterns.length > 0 ? prohibitedPatterns : undefined,
        risk,
        references: [category],
      });
    }
  }

  return rules;
}

export async function getAuburnTnC(category: string): Promise<AuburnTnC | null> {
  const rules = await loadAuburnTnCRules();
  const rule = rules.find(r => r.category.toLowerCase() === category.toLowerCase());
  
  if (!rule) return null;

  return {
    category: rule.category,
    preferredLanguage: rule.requirementText,
    commonProblems: rule.prohibitedPatterns,
  };
}
