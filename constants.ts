
import { TextModule } from './types';

export const TEXT_MODULES: TextModule[] = [
  { category: 'Beispiel', content: 'Das ist ein Beispiel Text.' },
];

export const SEVERITIES = ['Rot', 'Gruen'] as const;
export const ACTION_STATUSES = ['laufend', 'sofort'] as const;
