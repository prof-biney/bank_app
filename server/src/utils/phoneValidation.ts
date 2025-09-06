export type MobileNetwork = 'mtn' | 'telecel' | 'airteltigo';

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
export function validatePhoneForNetwork(phoneNumber: string, expectedNetwork: MobileNetwork): { isValid: boolean; error?: string; formattedNumber?: string } {
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
    
    const expectedPrefixes = NETWORK_PREFIXES[expectedNetwork].map(p => `0${p}X-XXX-XXX`).join(', ');
    
    return {
      isValid: false,
      error: `This number belongs to ${networkNames[detectedNetwork]}, not ${networkNames[expectedNetwork]}. ${networkNames[expectedNetwork]} numbers should start with: ${expectedPrefixes}`,
    };
  }
  
  return {
    isValid: true,
    formattedNumber: international,
  };
}

/**
 * Basic validation that number belongs to any supported network
 */
export function isValidGhanaianMobileNumber(phoneNumber: string): boolean {
  const cleaned = cleanPhoneNumber(phoneNumber);
  if (!cleaned) return false;
  
  const international = toInternationalFormat(cleaned);
  
  // Check basic format
  if (!international.startsWith('+233') || international.length !== 13) {
    return false;
  }
  
  // Check if it's all digits after +233
  const numberPart = international.substring(4);
  if (!/^\d{9}$/.test(numberPart)) {
    return false;
  }
  
  // Check if it belongs to any supported network
  return detectNetwork(international) !== null;
}
