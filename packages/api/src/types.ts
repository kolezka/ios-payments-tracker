export interface User {
  id: number;
  email: string;
  name: string;
  github_id: string | null;
  api_token: string;
  created_at: string;
}

export interface MagicLink {
  id: number;
  email: string;
  token: string;
  expires_at: string;
  used: number;
}

export interface Transaction {
  id: number;
  amount: number;
  card: string | null;
  seller: string;
  title: string | null;
  user_id: number | null;
  timestamp: string;
  created_at: string;
}
