import * as FileSystem from 'expo-file-system';

// PDF text extraction in React Native requires native modules or server-side processing.
// This mock implementation returns sample data for development/demo purposes.
// For production, consider using a backend API for PDF parsing.

export async function parsePdfText(uri: string): Promise<string> {
  // Verify the file exists
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error('PDF file not found');
  }

  // Return mock invoice/quote text for demo purposes
  // In production, send the file to a backend service for parsing
  const mockTexts = [
    `INVOICE #2024-001
Date: 15-01-2024
Client: ABC Construction BV

Description                    Qty    Unit Price    Total
Kitchen renovation labor       40h    €65.00        €2,600.00
Bathroom tiles installation    25h    €55.00        €1,375.00
Plumbing materials             1      €850.00       €850.00
Electrical work                15h    €70.00        €1,050.00

Subtotal: €5,875.00
VAT (21%): €1,233.75
Total: €7,108.75`,

    `QUOTE #Q-2024-042
Date: 20-01-2024
Project: Home Extension

Line Items:
- Foundation work: €4,500.00
- Framing and structure: €8,200.00
- Roofing: €3,800.00
- Windows and doors: €2,950.00
- Interior finishing: €6,100.00

Total estimate: €25,550.00
Valid for 30 days`,
  ];

  // Return a random mock text
  return mockTexts[Math.floor(Math.random() * mockTexts.length)];
}
