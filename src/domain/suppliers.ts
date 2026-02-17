export type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blocked';

export type Supplier = {
  id: string;
  name: string;
  accountStatus: SupplierStatus;
  creditTerms?: number;
  discountTier?: string;
  reliabilityScore?: number;
  avgLeadTimeDays?: number;
  onTimeDeliveryRate?: number;
  qualityScore?: number;
  avgPriceVsMarket?: number;
  priceConsistency?: number;
  totalSpend: number;
  totalOrders: number;
  lastOrderDate?: string;
  apiEnabled: boolean;
  catalogUrl?: string;
  createdAt: string;
  updatedAt: string;
};
