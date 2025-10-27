// T042: Session persistence using localStorage
// Purpose: Manage wallet session state persistence across browser sessions

const SESSION_KEYS = {
  WALLET_ID: 'walletId',
  WALLET_ADDRESS: 'walletAddress',
  WALLET_NETWORK: 'walletNetwork',
  NETWORK_PASSPHRASE: 'networkPassphrase',
  SESSION_TIMESTAMP: 'sessionTimestamp',
  LAST_ACTIVITY: 'lastActivity',
} as const;

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface WalletSession {
  walletId: string;
  walletAddress: string;
  walletNetwork: string;
  networkPassphrase: string;
  sessionTimestamp: number;
  lastActivity: number;
}

/**
 * Save wallet session to localStorage
 */
export function saveWalletSession(session: Partial<WalletSession>): void {
  try {
    const timestamp = Date.now();
    
    if (session.walletId) {
      localStorage.setItem(SESSION_KEYS.WALLET_ID, session.walletId);
    }
    if (session.walletAddress) {
      localStorage.setItem(SESSION_KEYS.WALLET_ADDRESS, session.walletAddress);
    }
    if (session.walletNetwork) {
      localStorage.setItem(SESSION_KEYS.WALLET_NETWORK, session.walletNetwork);
    }
    if (session.networkPassphrase) {
      localStorage.setItem(SESSION_KEYS.NETWORK_PASSPHRASE, session.networkPassphrase);
    }
    
    // Update session metadata
    if (!localStorage.getItem(SESSION_KEYS.SESSION_TIMESTAMP)) {
      localStorage.setItem(SESSION_KEYS.SESSION_TIMESTAMP, timestamp.toString());
    }
    localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, timestamp.toString());
  } catch (error) {
    console.error('Failed to save wallet session:', error);
  }
}

/**
 * Get wallet session from localStorage
 */
export function getWalletSession(): WalletSession | null {
  try {
    const walletId = localStorage.getItem(SESSION_KEYS.WALLET_ID);
    const walletAddress = localStorage.getItem(SESSION_KEYS.WALLET_ADDRESS);
    const walletNetwork = localStorage.getItem(SESSION_KEYS.WALLET_NETWORK);
    const networkPassphrase = localStorage.getItem(SESSION_KEYS.NETWORK_PASSPHRASE);
    const sessionTimestamp = localStorage.getItem(SESSION_KEYS.SESSION_TIMESTAMP);
    const lastActivity = localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);

    // Check if all required fields exist
    if (!walletId || !walletAddress || !walletNetwork || !networkPassphrase) {
      return null;
    }

    // Check session timeout
    if (lastActivity && isSessionExpired(parseInt(lastActivity))) {
      clearWalletSession();
      return null;
    }

    // Update last activity
    updateLastActivity();

    return {
      walletId,
      walletAddress,
      walletNetwork,
      networkPassphrase,
      sessionTimestamp: sessionTimestamp ? parseInt(sessionTimestamp) : Date.now(),
      lastActivity: lastActivity ? parseInt(lastActivity) : Date.now(),
    };
  } catch (error) {
    console.error('Failed to get wallet session:', error);
    return null;
  }
}

/**
 * Clear wallet session from localStorage
 */
export function clearWalletSession(): void {
  try {
    Object.values(SESSION_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear wallet session:', error);
  }
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  try {
    localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  } catch (error) {
    console.error('Failed to update last activity:', error);
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(lastActivity: number): boolean {
  const now = Date.now();
  return now - lastActivity > SESSION_TIMEOUT;
}

/**
 * Get session age in milliseconds
 */
export function getSessionAge(): number {
  try {
    const sessionTimestamp = localStorage.getItem(SESSION_KEYS.SESSION_TIMESTAMP);
    if (!sessionTimestamp) return 0;
    
    return Date.now() - parseInt(sessionTimestamp);
  } catch (error) {
    console.error('Failed to get session age:', error);
    return 0;
  }
}

/**
 * Check if wallet is connected (has valid session)
 */
export function isWalletConnected(): boolean {
  return getWalletSession() !== null;
}

/**
 * Get specific session value
 */
export function getSessionValue(key: keyof typeof SESSION_KEYS): string | null {
  try {
    return localStorage.getItem(SESSION_KEYS[key]);
  } catch (error) {
    console.error(`Failed to get session value for ${key}:`, error);
    return null;
  }
}

/**
 * Set specific session value
 */
export function setSessionValue(key: keyof typeof SESSION_KEYS, value: string): void {
  try {
    localStorage.setItem(SESSION_KEYS[key], value);
    updateLastActivity();
  } catch (error) {
    console.error(`Failed to set session value for ${key}:`, error);
  }
}

export default {
  saveWalletSession,
  getWalletSession,
  clearWalletSession,
  updateLastActivity,
  isSessionExpired,
  getSessionAge,
  isWalletConnected,
  getSessionValue,
  setSessionValue,
  SESSION_KEYS,
  SESSION_TIMEOUT,
};
