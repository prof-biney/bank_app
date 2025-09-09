import { logger } from '@/utils/logger';
import { useEffect } from "react";

// React Native doesn't have window object, so we use global instead
declare const global: {
  frameworkReady?: () => void;
  [key: string]: any;
};

export function useFrameworkReady() {
  useEffect(() => {
    // For React Native, we don't need to call frameworkReady
    // This hook is mainly for web-based React apps
    if (typeof global !== 'undefined' && global.frameworkReady) {
      global.frameworkReady();
    }
    
    // For React Native, we can just do nothing or add any app initialization logic here
    logger.info('HOOKS', 'Framework ready - React Native app initialized');
  }, []);
}
