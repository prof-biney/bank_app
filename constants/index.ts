import home from "@/assets/icons/home.png";

import logo from "@/assets/images/logo.png";

export const images = {
  logo,
  home,
};

export interface User {
  // Appwrite documents use $id; some parts of the app expect `id`.
  // Include both to ease migration: $id is primary, id is optional alias.
  $id: string;
  id: string;
  email: string;
  name: string;
  createdAt: string;
  avatar?: string; // URL of the profile picture or initials avatar
  avatarFileId?: string; // Appwrite storage file ID for uploaded profile pictures
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
  type: "deposit" | "transfer" | "withdraw" | "withdrawal" | "payment";
  amount: number;
  description: string;
  recipient?: string;
  category: string;
  date: string;
  status: "completed" | "pending" | "failed" | "rejected";
  fee?: number;
  // Mobile money details for deposits
  mobileNumber?: string;
  mobileNetwork?: string;
}

export interface Recipient {
  id: string;
  name: string;
  avatar: string;
  accountNumber: string;
}
