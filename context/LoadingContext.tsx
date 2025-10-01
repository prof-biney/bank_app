import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from './ThemeContext';
import { logger } from '@/lib/logger';

export type LoadingOperation = 
  | 'deposit'
  | 'transfer'
  | 'add_card'
  | 'delete_card'
  | 'delete_activity'
  | 'clear_activity'
  | 'clear_transactions'
  | 'update_balance'
  | 'sync_data'
  | 'login'
  | 'register'
  | 'custom';

interface LoadingItem {
  id: string;
  operation: LoadingOperation;
  message: string;
  startTime: number;
}

interface LoadingContextType {
  isLoading: boolean;
  activeOperations: LoadingItem[];
  startLoading: (operation: LoadingOperation, message?: string, customId?: string) => string;
  updateLoading: (operationId: string, message: string) => void;
  stopLoading: (operationId: string) => void;
  stopAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const defaultMessages: Record<LoadingOperation, string> = {
  deposit: 'Processing deposit...',
  transfer: 'Processing transfer...',
  add_card: 'Adding card...',
  delete_card: 'Removing card...',
  delete_activity: 'Deleting activity...',
  clear_activity: 'Clearing activity...',
  clear_transactions: 'Clearing transactions...',
  update_balance: 'Updating balance...',
  sync_data: 'Syncing data...',
  login: 'Signing in...',
  register: 'Creating account...',
  custom: 'Processing...',
};

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeOperations, setActiveOperations] = useState<LoadingItem[]>([]);
  const { colors } = useTheme();
  
  const startLoading = useCallback((
    operation: LoadingOperation, 
    customMessage?: string, 
    customId?: string
  ): string => {
    const id = customId || `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = customMessage || defaultMessages[operation];
    
    const newItem: LoadingItem = {
      id,
      operation,
      message,
      startTime: Date.now(),
    };
    
    logger.info('LOADING', '🔄 Starting loading operation', {
      id,
      operation,
      message,
    });
    
    setActiveOperations(prev => [...prev, newItem]);
    return id;
  }, []);
  
  const updateLoading = useCallback((operationId: string, message: string) => {
    logger.info('LOADING', '🔄 Updating loading message', { operationId, message });
    
    setActiveOperations(prev => {
      return prev.map(op => 
        op.id === operationId 
          ? { ...op, message }
          : op
      );
    });
  }, []);
  
  const stopLoading = useCallback((operationId: string) => {
    logger.info('LOADING', '✅ Stopping loading operation', { operationId });
    
    setActiveOperations(prev => {
      const item = prev.find(op => op.id === operationId);
      if (item) {
        const duration = Date.now() - item.startTime;
        logger.info('LOADING', '⏱️ Operation completed', {
          id: operationId,
          operation: item.operation,
          duration: `${duration}ms`,
        });
      }
      
      return prev.filter(op => op.id !== operationId);
    });
  }, []);
  
  const stopAllLoading = useCallback(() => {
    logger.info('LOADING', '🛑 Stopping all loading operations');
    setActiveOperations([]);
  }, []);
  
  const isLoading = activeOperations.length > 0;
  
  return (
    <LoadingContext.Provider value={{
      isLoading,
      activeOperations,
      startLoading,
      updateLoading,
      stopLoading,
      stopAllLoading,
    }}>
      {children}
      {isLoading && <LoadingOverlay operations={activeOperations} />}
    </LoadingContext.Provider>
  );
}

function LoadingOverlay({ operations }: { operations: LoadingItem[] }) {
  const { colors, isDark } = useTheme();
  const [fadeAnim] = React.useState(new Animated.Value(0));
  
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Show the most recent operation
  const currentOperation = operations[operations.length - 1];
  
  if (!currentOperation) return null;
  
  return (
    <Animated.View 
      style={[
        styles.overlay, 
        { 
          backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          opacity: fadeAnim,
        }
      ]}
      pointerEvents="none"
    >
      <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
        <ActivityIndicator 
          size="small" 
          color={colors.tintPrimary} 
          style={styles.spinner}
        />
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          {currentOperation.message}
        </Text>
        {operations.length > 1 && (
          <Text style={[styles.queueText, { color: colors.textSecondary }]}>
            +{operations.length - 1} more operations
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: '80%',
  },
  spinner: {
    marginRight: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  queueText: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
