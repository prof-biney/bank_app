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
    // Using React.useEffect to handle the setTimeout to avoid scheduling updates
    // during render or in useInsertionEffect
    if (duration > 0) {
      // We don't set up the timeout here to avoid scheduling updates
      // during render or in useInsertionEffect
    }
  };
  
  // Use useEffect to handle auto-removal of alerts with duration
  React.useEffect(() => {
    // Find alerts with duration that need timers
    const alertsWithDuration = alerts.filter(
      alert => alert.duration && alert.duration > 0
    );
    
    // Set up timers for each alert
    const timers = alertsWithDuration.map(alert => {
      return setTimeout(() => {
        hideAlert(alert.id);
      }, alert.duration);
    });
    
    // Clean up timers on unmount or when alerts change
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [alerts]);

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