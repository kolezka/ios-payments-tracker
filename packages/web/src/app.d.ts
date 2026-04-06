declare global {
  namespace App {
    interface Locals {
      authToken: string;
      user: {
        id: number;
        email: string;
        name: string;
        api_token: string;
        created_at: string;
      } | null;
    }
  }
}

export {};
