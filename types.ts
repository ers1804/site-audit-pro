
export interface DistributionRecipient {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  isPresent: boolean;
}

export interface Deviation {
  id: string;
  photoUrl?: string;
  textModule: string;
  location?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  responsible?: string;
  actionStatus?: 'laufend' | 'sofort';
}

export interface SiteReport {
  id: string;
  projectName: string;
  projectNumber: string;
  reportNumber: string;
  visitDate: string;
  visitTime: string;
  location: string;
  author: string;
  inspector: string;
  distributionList: DistributionRecipient[];
  deviations: Deviation[];
  status: 'Draft' | 'Final';
}

export interface TextModule {
  id?: string;
  category: string;
  content: string;
}
