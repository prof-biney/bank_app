import { Card, Recipient, Transaction } from "../types";

export const mockCards: Card[] = [
  {
    id: "1",
    userId: "user1",
    cardNumber: "•••• •••• •••• 1990",
    cardHolderName: "Andrew Biney",
    expiryDate: "12/26",
    balance: 10250.0,
    cardType: "visa",
    isActive: true,
    cardColor: "#1F2937",
  },
  {
    id: "2",
    userId: "user1",
    cardNumber: "•••• •••• •••• 2455",
    cardHolderName: "Andrew Biney",
    expiryDate: "08/27",
    balance: 5420.75,
    cardType: "mastercard",
    isActive: false,
    cardColor: "#0F766E",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "1",
    userId: "user1",
    cardId: "1",
    type: "payment",
    amount: -45.99,
    description: "Gym Payment",
    category: "Fitness",
    date: "2025-01-20T10:30:00Z",
    status: "completed",
  },
  {
    id: "2",
    userId: "user1",
    cardId: "1",
    type: "deposit",
    amount: 1320.0,
    description: "Bank of America",
    category: "Income",
    date: "2025-01-19T14:15:00Z",
    status: "completed",
  },
  {
    id: "3",
    userId: "user1",
    cardId: "1",
    type: "transfer",
    amount: -699.0,
    description: "To Brady Armando",
    recipient: "Brady Armando",
    category: "Transfer",
    date: "2025-01-18T09:45:00Z",
    status: "completed",
  },
  {
    id: "4",
    userId: "user1",
    cardId: "1",
    type: "withdraw",
    amount: -120.0,
    description: "ATM Withdrawal",
    category: "Cash",
    date: "2025-01-17T16:20:00Z",
    status: "completed",
  },
];

export const mockRecipients: Recipient[] = [
  {
    id: "1",
    name: "Maria Sorentino",
    avatar:
      "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop&crop=face",
    accountNumber: "****2891",
  },
  {
    id: "2",
    name: "Andreas Alexander Rose",
    avatar:
      "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop&crop=face",
    accountNumber: "****7542",
  },
  {
    id: "3",
    name: "Mike Prince",
    avatar:
      "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop&crop=face",
    accountNumber: "****1337",
  },
];
