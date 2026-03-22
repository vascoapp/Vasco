// =============================================================================
// TRADE-BASED FEATURE CONFIGURATION
// =============================================================================
// Controls which features are visible/prominent per trade type.
// Used across contractor screens to show relevant features only.
// =============================================================================

export type Trade = 'plumbing' | 'electrical' | 'gas' | 'painting' | 'carpentry' | 'general' | 'other';

export interface TradeConfig {
  // Display
  label: string;
  labelNL: string;
  icon: string;

  // Feature flags — which screens/features are relevant
  showPermits: boolean;
  showPurchaseOrders: boolean;
  showRouteOptimizer: boolean;
  showSafetyDocs: boolean;
  showMaterialsTracking: boolean;
  showSubcontractors: boolean;

  // Prominent features — shown first on dashboard
  primaryActions: string[];

  // Hidden features — not shown (but accessible via search)
  hiddenFeatures: string[];
}

export const TRADE_CONFIGS: Record<Trade, TradeConfig> = {
  plumbing: {
    label: 'Plumber',
    labelNL: 'Loodgieter',
    icon: 'water-outline',
    showPermits: true,
    showPurchaseOrders: true,
    showRouteOptimizer: true,
    showSafetyDocs: true,
    showMaterialsTracking: true,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'expenses', 'permits'],
    hiddenFeatures: [],
  },
  electrical: {
    label: 'Electrician',
    labelNL: 'Elektricien',
    icon: 'flash-outline',
    showPermits: true,
    showPurchaseOrders: true,
    showRouteOptimizer: true,
    showSafetyDocs: true,
    showMaterialsTracking: true,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'permits', 'certificates'],
    hiddenFeatures: [],
  },
  gas: {
    label: 'Gas Engineer',
    labelNL: 'Installateur (gas)',
    icon: 'flame-outline',
    showPermits: true,
    showPurchaseOrders: true,
    showRouteOptimizer: true,
    showSafetyDocs: true,
    showMaterialsTracking: true,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'certificates', 'permits'],
    hiddenFeatures: [],
  },
  painting: {
    label: 'Painter',
    labelNL: 'Schilder',
    icon: 'color-palette-outline',
    showPermits: false,
    showPurchaseOrders: false,
    showRouteOptimizer: false,
    showSafetyDocs: false,
    showMaterialsTracking: false,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'expenses', 'customers'],
    hiddenFeatures: ['permits', 'purchase-orders', 'safety-docs', 'route-optimizer'],
  },
  carpentry: {
    label: 'Carpenter',
    labelNL: 'Timmerman',
    icon: 'construct-outline',
    showPermits: false,
    showPurchaseOrders: true,
    showRouteOptimizer: false,
    showSafetyDocs: false,
    showMaterialsTracking: true,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'expenses', 'purchase-orders'],
    hiddenFeatures: ['permits', 'route-optimizer', 'safety-docs'],
  },
  general: {
    label: 'General Contractor',
    labelNL: 'Aannemer',
    icon: 'business-outline',
    showPermits: true,
    showPurchaseOrders: true,
    showRouteOptimizer: true,
    showSafetyDocs: true,
    showMaterialsTracking: true,
    showSubcontractors: true,
    primaryActions: ['pipeline', 'invoices', 'permits', 'expenses'],
    hiddenFeatures: [],
  },
  other: {
    label: 'Other',
    labelNL: 'Anders',
    icon: 'build-outline',
    showPermits: true,
    showPurchaseOrders: true,
    showRouteOptimizer: false,
    showSafetyDocs: false,
    showMaterialsTracking: false,
    showSubcontractors: false,
    primaryActions: ['pipeline', 'invoices', 'expenses'],
    hiddenFeatures: ['safety-docs', 'route-optimizer'],
  },
};

export function getTradeConfig(trade?: string): TradeConfig {
  if (trade && trade in TRADE_CONFIGS) {
    return TRADE_CONFIGS[trade as Trade];
  }
  return TRADE_CONFIGS.general; // default
}

// Hook for use in components
import { useAuth } from '../context/AuthContext';

export function useTradeConfig(): TradeConfig {
  const { user } = useAuth();
  return getTradeConfig(user?.trade);
}
