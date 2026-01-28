export type MoneybirdExportResult = {
  success: boolean;
  exportedAt: string;
};

export async function exportInvoiceToMoneybird(
  invoiceId: string
): Promise<MoneybirdExportResult> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    success: true,
    exportedAt: new Date().toISOString(),
  };
}
