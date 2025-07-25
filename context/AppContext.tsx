import React, { createContext, ReactNode, useContext, useState } from "react";
import { Card, Transaction } from "../constants/index";
import { mockCards, mockTransactions } from "../lib/mockdata";

interface AppContextType {
  cards: Card[];
  transactions: Transaction[];
  activeCard: Card | null;
  setActiveCard: (card: Card) => void;
  addTransaction: (transaction: Omit<Transaction, "id" | "date">) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cards] = useState<Card[]>(mockCards);
  const [transactions, setTransactions] =
    useState<Transaction[]>(mockTransactions);
  const [activeCard, setActiveCard] = useState<Card | null>(mockCards[0]);

  const addTransaction = (
    transactionData: Omit<Transaction, "id" | "date">
  ) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        cards,
        transactions,
        activeCard,
        setActiveCard,
        addTransaction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
