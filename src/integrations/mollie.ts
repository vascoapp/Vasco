export type MolliePaymentResult = {
  success: boolean;
  paymentId: string;
  checkoutUrl: string;
};

export async function createMolliePayment(
  invoiceId: string,
  amount: number
): Promise<MolliePaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    success: true,
    paymentId: `pay_${invoiceId}`,
    checkoutUrl: 'https://www.mollie.com/payments',
  };
}
