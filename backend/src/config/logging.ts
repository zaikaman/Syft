/**
 * Logging configuration
 * Set to true to enable verbose logging, false to reduce noise
 */

export const LOGGING = {
  // Deployment logs (important - keep enabled)
  VAULT_DEPLOYMENT: true,
  ROUTER_SETUP: true,
  
  // Monitoring logs (very verbose - disable)
  VAULT_MONITORING: false,
  ANALYTICS: false,
  PERFORMANCE_SNAPSHOTS: false,
  
  // Request logs (moderate - keep for debugging)
  API_REQUESTS: true,
  
  // Service logs
  PRICE_SERVICE: false,
  TRANSACTION_SERVICE: false,
};

// Helper functions
export function logDeployment(...args: any[]) {
  if (LOGGING.VAULT_DEPLOYMENT) console.log(...args);
}

export function logRouter(...args: any[]) {
  if (LOGGING.ROUTER_SETUP) console.log(...args);
}

export function logMonitoring(...args: any[]) {
  if (LOGGING.VAULT_MONITORING) console.log(...args);
}

export function logAnalytics(...args: any[]) {
  if (LOGGING.ANALYTICS) console.log(...args);
}

export function logPrice(...args: any[]) {
  if (LOGGING.PRICE_SERVICE) console.log(...args);
}

export function logTransaction(...args: any[]) {
  if (LOGGING.TRANSACTION_SERVICE) console.log(...args);
}
