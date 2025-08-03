import React, { createContext, ReactNode, useContext, useState } from 'react';

// Define the types of alerts
export type AlertType = 'success' | 'error' | 'warning' | 'info';

// Define the alert message structure
export interface AlertMessage {
  id: string;
  type: AlertType;
  message: string;
  title?: string;
  duration?: number;
}

// Define the context type
interface AlertContextType {
  alerts: AlertMessage[];
  showAlert: (type: AlertType, message: string, title?: string, duration?: number) => void;
  hideAlert: (id: string) => void;
}

// Create the context with a default value
const AlertContext = createContext<AlertContextType | undefined>(undefined);

// Create the provider component
export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  // Function to show an alert
  const showAlert = (
    type: AlertType,
    message: string,
    title?: string,
    duration: number = 3000
  ) => {
    // Create a unique ID for the alert
    const id = Date.now().toString();
    
    // Add the alert to the state
    setAlerts((prevAlerts) => [
      ...prevAlerts,
      { id, type, message, title, duration },
    ]);

    // Automatically remove the alert after the specified duration
    if (duration > 0) {
      setTimeout(() => {
        hideAlert(id);
      }, duration);
    }
  };

  // Function to hide an alert
  const hideAlert = (id: string) => {
    setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.id !== id));
  };

  return (
    <AlertContext.Provider value={{ alerts, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
}

// Custom hook to use the alert context
export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}