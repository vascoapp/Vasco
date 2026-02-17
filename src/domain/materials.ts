export type DemandPattern = 'steady' | 'seasonal' | 'project_based';
export type JobMaterialStatus = 'planned' | 'ordered' | 'delivered' | 'installed';

export type Material = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  sku?: string;
  ean?: string;
  manufacturerCode?: string;
  baseUnit: string;
  unitConversions?: Record<string, number>;
  aliases: string[];
  specifications?: Record<string, string>;
  demandPattern: DemandPattern;
  avgMonthlyUsage?: number;
  reorderPoint?: number;
  createdAt: string;
  updatedAt: string;
};

export type PriceObservation = {
  id: string;
  materialId: string;
  materialName: string;
  supplierId?: string;
  supplierName?: string;
  price: number;
  currency: string;
  unit: string;
  source: string;
  confidence: number;
  isSale: boolean;
  saleEndDate?: string;
  regularPrice?: number;
  inStock?: boolean;
  stockLevel?: string;
  leadTimeDays?: number;
  minQuantity?: number;
  bulkPricing?: unknown;
  observedAt: string;
  createdAt: string;
};

export type JobMaterial = {
  id: string;
  jobId: string;
  materialId: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  supplierId?: string;
  status: JobMaterialStatus;
  notes?: string;
  orderedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
};
