import React, { useEffect } from 'react';
import { useAlert } from '@/context/AlertContext';
import { initConnectionMonitoring } from '@/lib/connectionService';

interface ConnectionMonitorWrapperProps {
  children: React.ReactNode;
}

/**
 * ConnectionMonitorWrapper
 * 
 * This component initializes the connection monitoring system with the alert context.
 * It must be placed inside the AlertProvider but outside the AppProvider.
 */
export function ConnectionMonitorWrapper({ children }: ConnectionMonitorWrapperProps) {
  const { showAlert } = useAlert();
  
  useEffect(() => {
    // Initialize connection monitoring with alert system
    initConnectionMonitoring(showAlert);
    
    console.log('[ConnectionMonitorWrapper] Connection monitoring initialized with alert system');
  }, [showAlert]);
  
  return <>{children}</>;
}
