export interface Transaction {
  id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string | null;
  note: string | null;
  card_last4: string | null;
  timestamp: string;
  created_at: string;
}
