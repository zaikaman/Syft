// Real-time price monitoring service
// Purpose: Provides live mainnet price updates with configurable refresh intervals
// ARCHITECTURE: Always uses mainnet for accurate, up-to-date pricing

import { getCurrentPrice } from './historicalDataService';

export interface PriceSubscription {
  assetCode: string;
  assetIssuer?: string;
  counterAssetCode?: string;
  counterAssetIssuer?: string;
  interval: number; // milliseconds
  callback: (price: number, timestamp: Date) => void;
}

interface ActiveSubscription extends PriceSubscription {
  id: string;
  intervalHandle: NodeJS.Timeout;
  lastPrice?: number;
  lastUpdate?: Date;
}

class RealtimePriceService {
  private subscriptions: Map<string, ActiveSubscription> = new Map();

  /**
   * Subscribe to real-time price updates from mainnet
   * @param subscription - Price subscription configuration
   * @returns Subscription ID for later unsubscription
   */
  subscribe(subscription: PriceSubscription): string {
    const id = this.generateSubscriptionId(subscription);

    // If already subscribed, return existing ID
    if (this.subscriptions.has(id)) {
      console.log(`[Realtime Price] Already subscribed to ${subscription.assetCode}, returning existing subscription`);
      return id;
    }

    // Start fetching prices at the specified interval
    const intervalHandle = setInterval(async () => {
      try {
        const price = await getCurrentPrice(
          subscription.assetCode,
          subscription.assetIssuer,
          subscription.counterAssetCode || 'USDC',
          subscription.counterAssetIssuer
        );

        const timestamp = new Date();
        const activeSub = this.subscriptions.get(id);
        
        if (activeSub) {
          activeSub.lastPrice = price;
          activeSub.lastUpdate = timestamp;
          subscription.callback(price, timestamp);
        }
      } catch (error: any) {
        console.error(`[Realtime Price] Error fetching price for ${subscription.assetCode}:`, error.message);
      }
    }, subscription.interval);

    // Fetch immediately on subscription
    getCurrentPrice(
      subscription.assetCode,
      subscription.assetIssuer,
      subscription.counterAssetCode || 'USDC',
      subscription.counterAssetIssuer
    ).then((price) => {
      const timestamp = new Date();
      const activeSub = this.subscriptions.get(id);
      if (activeSub) {
        activeSub.lastPrice = price;
        activeSub.lastUpdate = timestamp;
      }
      subscription.callback(price, timestamp);
    }).catch((error) => {
      console.error(`[Realtime Price] Error fetching initial price for ${subscription.assetCode}:`, error.message);
    });

    // Store the active subscription
    this.subscriptions.set(id, {
      ...subscription,
      id,
      intervalHandle,
    });

    console.log(`[Realtime Price] ✓ Subscribed to ${subscription.assetCode}/${subscription.counterAssetCode || 'USDC'} updates every ${subscription.interval}ms`);
    return id;
  }

  /**
   * Unsubscribe from price updates
   * @param subscriptionId - ID returned from subscribe()
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      console.warn(`[Realtime Price] Subscription ${subscriptionId} not found`);
      return false;
    }

    clearInterval(subscription.intervalHandle);
    this.subscriptions.delete(subscriptionId);
    
    console.log(`[Realtime Price] ✓ Unsubscribed from ${subscription.assetCode}`);
    return true;
  }

  /**
   * Get the last cached price for a subscription (no API call)
   * @param subscriptionId - ID returned from subscribe()
   */
  getLastPrice(subscriptionId: string): { price: number; timestamp: Date } | null {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription || !subscription.lastPrice || !subscription.lastUpdate) {
      return null;
    }

    return {
      price: subscription.lastPrice,
      timestamp: subscription.lastUpdate,
    };
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Clear all subscriptions (useful for cleanup)
   */
  clearAll(): void {
    for (const [id, subscription] of this.subscriptions.entries()) {
      clearInterval(subscription.intervalHandle);
      this.subscriptions.delete(id);
    }
    console.log('[Realtime Price] ✓ Cleared all subscriptions');
  }

  private generateSubscriptionId(subscription: PriceSubscription): string {
    const asset = subscription.assetIssuer 
      ? `${subscription.assetCode}:${subscription.assetIssuer}`
      : subscription.assetCode;
    
    const counter = subscription.counterAssetIssuer
      ? `${subscription.counterAssetCode}:${subscription.counterAssetIssuer}`
      : subscription.counterAssetCode || 'USDC';

    return `${asset}/${counter}`;
  }
}

// Export singleton instance
export const realtimePriceService = new RealtimePriceService();

export default realtimePriceService;
