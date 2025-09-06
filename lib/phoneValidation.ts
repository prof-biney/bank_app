export type MobileNetwork = 'mtn' | 'telecel' | 'airteltigo';

export interface PhoneValidationResult {
  isValid: boolean;
  network?: MobileNetwork;
  formattedNumber?: string;
  error?: string;
}

// Network prefixes for Ghanaian mobile networks
const NETWORK_PREFIXES = {
  mtn: ['24', '25', '54', '55'], // +23324/024, +23325/025, +23354/054, +23355/055
  telecel: ['20', '50'], // +23320/020, +23350/050
  airteltigo: ['26', '27', '56', '57'], // +23326/026, +23327/027, +23356/056, +23357/057
} as const;

/**
 * Clean and normalize phone number by removing spaces, dashes, and formatting
 */
export function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[\s\-\(\)]/g, '');
}

/**
 * Convert phone number to international format (+233XXXXXXXXX)
 */
export function toInternationalFormat(phoneNumber: string): string {
  const cleaned = cleanPhoneNumber(phoneNumber);
  
  // Already in international format
  if (cleaned.startsWith('+233')) {
    return cleaned;
  }
  
  // Starts with 233 but no +
  if (cleaned.startsWith('233')) {
    return '+' + cleaned;
  }
  
  // Starts with 0, replace with +233
  if (cleaned.startsWith('0')) {
    return '+233' + cleaned.substring(1);
  }
  
  // Just the 9-digit number, add +233
  if (cleaned.length === 9) {
    return '+233' + cleaned;
  }
  
  return phoneNumber; // Return as-is if format is unclear
}

/**
 * Extract the network prefix from a phone number
 */
export function getNetworkPrefix(phoneNumber: string): string | null {
  const international = toInternationalFormat(phoneNumber);
  
  // Should be in format +233XXXXXXXXX (13 characters total)
  if (!international.startsWith('+233') || international.length !== 13) {
    return null;
  }
  
  // Extract the 2-digit prefix after +233
  return international.substring(4, 6);
}

/**
 * Detect which network a phone number belongs to
 */
export function detectNetwork(phoneNumber: string): MobileNetwork | null {
  const prefix = getNetworkPrefix(phoneNumber);
  if (!prefix) return null;
  
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix as any)) {
      return network as MobileNetwork;
    }
  }
  
  return null;
}

/**
 * Validate phone number for a specific network
 */
export function validatePhoneForNetwork(phoneNumber: string, expectedNetwork: MobileNetwork): PhoneValidationResult {
  const cleaned = cleanPhoneNumber(phoneNumber);
  
  // Check if number is empty
  if (!cleaned) {
    return {
      isValid: false,
      error: 'Phone number is required',
    };
  }
  
  const international = toInternationalFormat(cleaned);
  
  // Check basic format
  if (!international.startsWith('+233') || international.length !== 13) {
    return {
      isValid: false,
      error: 'Please enter a valid Ghanaian phone number (10 digits)',
    };
  }
  
  // Check if it's all digits after +233
  const numberPart = international.substring(4);
  if (!/^\d{9}$/.test(numberPart)) {
    return {
      isValid: false,
      error: 'Phone number must contain only digits',
    };
  }
  
  const prefix = getNetworkPrefix(international);
  const detectedNetwork = detectNetwork(international);
  
  if (!detectedNetwork) {
    return {
      isValid: false,
      error: 'This number does not belong to any supported network',
    };
  }
  
  if (detectedNetwork !== expectedNetwork) {
    const networkNames = {
      mtn: 'MTN',
      telecel: 'Telecel',
      airteltigo: 'AirtelTigo',
    };
    
    const expectedPrefixes = NETWORK_PREFIXES[expectedNetwork].map(p => `024${p.substring(1)} / +2332${p}`).join(', ');
    
    return {
      isValid: false,
      error: `This number belongs to ${networkNames[detectedNetwork]}, not ${networkNames[expectedNetwork]}. ${networkNames[expectedNetwork]} numbers should start with: ${expectedPrefixes}`,
    };
  }
  
  return {
    isValid: true,
    network: detectedNetwork,
    formattedNumber: international,
  };
}

/**
 * Get example phone numbers for a network
 */
export function getExampleNumbers(network: MobileNetwork): string[] {
  const prefixes = NETWORK_PREFIXES[network];
  return prefixes.map(prefix => `0${prefix}4-123-456`);
}

/**
 * Get network display information
 */
export function getNetworkInfo(network: MobileNetwork) {
  const info = {
    mtn: {
      name: 'MTN',
      color: '#FFCC00',
      ussd: '*170#',
      prefixes: NETWORK_PREFIXES.mtn,
      examples: getExampleNumbers('mtn'),
    },
    telecel: {
      name: 'Telecel',
      color: '#0066CC',
      ussd: '*110#',
      prefixes: NETWORK_PREFIXES.telecel,
      examples: getExampleNumbers('telecel'),
    },
    airteltigo: {
      name: 'AirtelTigo',
      color: '#FF0000',
      ussd: '*110#',
      prefixes: NETWORK_PREFIXES.airteltigo,
      examples: getExampleNumbers('airteltigo'),
    },
  };
  
  return info[network];
}

/**
 * Format phone number for display (e.g., 0244-123-456)
 */
export function formatPhoneForDisplay(phoneNumber: string): string {
  const international = toInternationalFormat(phoneNumber);
  
  if (!international.startsWith('+233') || international.length !== 13) {
    return phoneNumber; // Return original if invalid
  }
  
  const localNumber = '0' + international.substring(4);
  
  // Format as 0XXX-XXX-XXX
  return localNumber.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
}
