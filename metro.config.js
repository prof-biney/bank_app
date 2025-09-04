const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require('path');

// Patch path.relative to handle undefined values from Metro bundler
// This is specifically to fix Node.js v23+ compatibility issues
const originalRelative = path.relative;
path.relative = function(from, to) {
  if (typeof to === 'undefined' || to === null) {
    // Only warn in development and provide a more specific fallback
    if (__DEV__) {
      console.warn('Metro: Encountered undefined module path, this may indicate a bundler issue');
    }
    return 'metro-undefined-module';
  }
  if (typeof from === 'undefined' || from === null) {
    if (__DEV__) {
      console.warn('Metro: Encountered undefined from path, using project directory');
    }
    from = __dirname;
  }
  return originalRelative.call(this, from, to);
};

const config = getDefaultConfig(__dirname);

// Disable error overlay in development
if (process.env.NODE_ENV === 'development') {
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Disable error overlay by intercepting error requests
        if (req.url && req.url.includes('__metro_error_overlay')) {
          res.writeHead(404);
          res.end();
          return;
        }
        return middleware(req, res, next);
      };
    },
  };
}

module.exports = withNativeWind(config, { input: "./app/global.css" });
