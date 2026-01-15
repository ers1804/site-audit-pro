
import { TextModule } from './types';

export const TEXT_MODULES: TextModule[] = [
  { category: 'Safety', content: 'Missing guardrails on the 3rd-floor scaffolding. Immediate fall hazard identified.' },
  { category: 'Safety', content: 'Workers found without proper PPE (helmets/high-vis) in the active loading zone.' },
  { category: 'Quality', content: 'Concrete curing process not being monitored as per specs. Cracking visible on slab B2.' },
  { category: 'Quality', content: 'Reinforcement bars showing signs of oxidation. Cleaning required before pouring.' },
  { category: 'Housekeeping', content: 'Construction debris blocking fire escape routes. Immediate clearance required.' },
  { category: 'Housekeeping', content: 'Electrical cables trailing across walkways without protection. Trip hazard.' },
  { category: 'Environmental', content: 'Spill kit missing near fuel storage area. Potential for soil contamination.' },
  { category: 'Progress', content: 'Installation of window frames delayed due to late delivery. Schedule impact: 2 days.' },
];

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const ACTION_STATUSES = ['laufend', 'sofort'] as const;
