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

export interface CreateTransactionInput {
  amount: number;
  currency?: string;
  merchant: string;
  category?: string;
  note?: string;
  card_last4?: string;
}
