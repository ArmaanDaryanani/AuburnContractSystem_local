import { PolicyRule, FARClause, RiskLevel } from './types';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

export async function loadFARRules(): Promise<PolicyRule[]> {
  const rules: PolicyRule[] = [];
  const policyDir = path.join(process.cwd(), 'data', 'policy');
  
  const farFiles = fs.readdirSync(policyDir).filter(f => 
    f.startsWith('2023-03-20_FARMatrix_') && 
    f.endsWith('.csv') &&
    f !== '2023-03-20_FARMatrix_Definitions.csv'
  );

  for (const file of farFiles) {
    const filePath = path.join(policyDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as any[];

    const source = file.replace('2023-03-20_FARMatrix_', '').replace('.csv', '');

    for (const record of records) {
      if (!record['Clause'] || record['Clause'].startsWith('OLD') || record['Clause'] === 'KEY:') {
        continue;
      }

      const acceptanceStatus = record['Acceptance Status*'] || record['Acceptance Status'];
      
      if (!acceptanceStatus || acceptanceStatus === 'OK') {
        continue;
      }

      const clause = record['Clause'];
      const title = record['Title'] || '';
      const criteria = record['Acceptance Criteria or Additional Notes'] || '';
      const requestToSponsor = record['Request to Sponsor'] || '';

      let risk: RiskLevel = 'MEDIUM';
      if (acceptanceStatus === 'REMOVE') {
        risk = 'HIGH';
      } else if (criteria.toLowerCase().includes('critical')) {
        risk = 'CRITICAL';
      } else if (criteria.toLowerCase().includes('required')) {
        risk = 'HIGH';
      }

      const prohibitedPatterns: string[] = [];
      if (title) {
        prohibitedPatterns.push(title.toLowerCase());
      }
      if (clause.includes('52.')) {
        prohibitedPatterns.push(`far ${clause}`);
        prohibitedPatterns.push(`clause ${clause}`);
      }

      rules.push({
        id: `FAR-${source}-${clause}`,
        source: 'FAR',
        category: source,
        requirementText: requestToSponsor || criteria,
        prohibitedPatterns: acceptanceStatus === 'REMOVE' ? prohibitedPatterns : undefined,
        risk,
        references: [clause, title].filter(Boolean),
        acceptanceStatus,
        acceptanceCriteria: criteria,
        requestToSponsor,
      });
    }
  }

  return rules;
}

export async function getFARClause(clauseNumber: string): Promise<FARClause | null> {
  const rules = await loadFARRules();
  const rule = rules.find(r => r.references?.includes(clauseNumber));
  
  if (!rule) return null;

  return {
    clause: rule.references?.[0] || '',
    title: rule.references?.[1] || '',
    date: '',
    acceptanceStatus: rule.acceptanceStatus || 'C',
    criteria: rule.acceptanceCriteria,
    requestToSponsor: rule.requestToSponsor,
  };
}
