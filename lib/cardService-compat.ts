// Compatibility wrapper for cardService (moved from lib/appwriteCardService.ts)
import * as _cardService from './cardService';

export * from './cardService';

// Default export: forward the whole module so callers using `import cardService from './appwriteCardService'` still work
export default _cardService;
