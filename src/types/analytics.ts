export interface AnalyticsFilters {
  period: string;
  city?: string;
  startDate?: string;
  endDate?: string;
}

export interface KPIData {
  totalAnnonces: number;
  totalAnnoncesVariation: number;
  totalAnnoncesPro: number;
  totalAnnoncesProVariation: number;
  totalOnlineAnnonces: number;
  totalOnlineAnnoncesVariation: number;
  propertiesProcessed?: number;
  propertiesProcessedVariation?: number;
  appelsPasses: number;
  appelsPassesVariation: number;
  rappelsAFaire: number;
  rappelsAFaireVariation: number;
  toProcessReminders: number;
  toProcessRemindersVariation: number;
  surveillancesActives: number;
  surveillancesActivesVariation: number;
  newPropertiesParticulierToday: number;
  newPropertiesParticulierTodayVariation: number;
  newPropertiesProToday: number;
  newPropertiesProTodayVariation: number;
  conversionRate?: number;
  conversionRateVariation?: number;
}

export interface EvolutionData {
  date: string;
  annonces?: number;
  annoncesParticulier?: number;
  annoncesPro?: number;
  appels: number;
}

export interface DonutData {
  name: string;
  value: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  type: 'appel' | 'rappel' | 'annonce' | 'surveillance';
  description: string;
  timestamp: string;
  icon: string;
}

export interface AnalyticsData {
  kpis: KPIData;
  evolution: EvolutionData[];
  propertyTypesPro: DonutData[];
  propertyTypesParticulier: DonutData[];
  statusDistribution: DonutData[];
  recentActivity: ActivityItem[];
}
