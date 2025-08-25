import home from "@/assets/icons/home.png";

import logo from "@/assets/images/logo.png";

export const images = {
  logo,
  home,
};

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Card {
  id: string;
  userId: string;
  cardNumber: string;
  cardHolderName: string;
  expiryDate: string;
  balance: number;
  cardType: "visa" | "mastercard" | "amex" | "discover" | "card";
  isActive: boolean;
  cardColor: string;
  token?: string;
  currency?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  cardId: string;
  type: "deposit" | "transfer" | "withdraw" | "payment";
  amount: number;
  description: string;
  recipient?: string;
  category: string;
  date: string;
  status: "completed" | "pending" | "failed";
}

export interface Recipient {
  id: string;
  name: string;
  avatar: string;
  accountNumber: string;
}
