import { useCallback, useEffect, useState, useRef } from "react";
import { useWallet } from "./useWallet";
import { fetchBalance, type Balance } from "../util/wallet";
import { Horizon } from "@stellar/stellar-sdk";
import { horizonUrl, stellarNetwork } from "../contracts/util";

const formatter = new Intl.NumberFormat();

const checkFunding = (balances: Balance[]) =>
  balances.some(({ balance }) =>
    !Number.isNaN(Number(balance)) ? Number(balance) > 0 : false,
  );

type WalletBalance = {
  balances: Balance[];
  xlm: string;
  isFunded: boolean;
  isLoading: boolean;
  error: Error | null;
};

// Fallback polling interval (30 seconds) - only used if streaming fails
const FALLBACK_POLL_INTERVAL = 30000;

export const useWalletBalance = () => {
  const { address, network } = useWallet();
  const [state, setState] = useState<WalletBalance>({
    balances: [],
    xlm: "-",
    isFunded: false,
    isLoading: false,
    error: null,
  });
  const streamCloseRef = useRef<(() => void) | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  const updateBalance = useCallback(async () => {
    if (!address) {
      console.log("[useWalletBalance] No address, skipping balance fetch");
      return;
    }
    
    console.log("[useWalletBalance] Fetching balance for address:", address);
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const balances = await fetchBalance(address, network);
      
      const isFunded = checkFunding(balances);
      const native = balances.find(({ asset_type }) => asset_type === "native");
      
      const formattedXlm = native?.balance ? formatter.format(Number(native.balance)) : "-";
      console.log("[useWalletBalance] Balance updated:", formattedXlm);
      
      setState({
        isLoading: false,
        balances,
        xlm: formattedXlm,
        isFunded,
        error: null,
      });
    } catch (err) {
      console.error("[useWalletBalance] Error fetching balance:", err);
      if (err instanceof Error && err.message.match(/not found/i)) {
        setState({
          isLoading: false,
          balances: [],
          xlm: "0",
          isFunded: false,
          error: new Error("Error fetching balance. Is your wallet funded?"),
        });
      } else {
        setState({
          isLoading: false,
          balances: [],
          xlm: "0",
          isFunded: false,
          error: new Error("Unknown error fetching balance."),
        });
      }
    }
  }, [address, network]);

  // Setup real-time streaming with fallback polling
  useEffect(() => {
    if (!address) {
      return;
    }

    // Initial fetch
    void updateBalance();

    // Determine Horizon URL based on network
    let networkHorizonUrl = horizonUrl;
    if (network) {
      const normalizedNetwork = network.toLowerCase();
      if (normalizedNetwork === 'futurenet' || normalizedNetwork === 'standalone') {
        networkHorizonUrl = 'https://horizon-futurenet.stellar.org';
      } else if (normalizedNetwork === 'testnet') {
        networkHorizonUrl = 'https://horizon-testnet.stellar.org';
      } else if (normalizedNetwork === 'mainnet' || normalizedNetwork === 'public') {
        networkHorizonUrl = 'https://horizon.stellar.org';
      }
    }

    console.log("[useWalletBalance] Setting up real-time stream for:", address);
    
    const setupStream = () => {
      // Clear any existing stream
      if (streamCloseRef.current) {
        streamCloseRef.current();
        streamCloseRef.current = null;
      }

      const horizon = new Horizon.Server(networkHorizonUrl, {
        allowHttp: (network || stellarNetwork) === "LOCAL" || networkHorizonUrl.startsWith("http://"),
      });

      try {
        // Stream account updates in real-time
        const closeStream = horizon
          .accounts()
          .accountId(address)
          .stream({
            onmessage: (account) => {
              console.log("[useWalletBalance] ✅ Real-time update received via stream");
              isStreamingRef.current = true;
              
              const balances = account.balances;
              const isFunded = checkFunding(balances);
              const native = balances.find(({ asset_type }) => asset_type === "native");
              const formattedXlm = native?.balance ? formatter.format(Number(native.balance)) : "-";
              
              setState({
                isLoading: false,
                balances,
                xlm: formattedXlm,
                isFunded,
                error: null,
              });
            },
            onerror: (error) => {
              console.error("[useWalletBalance] ❌ Stream error:", error);
              isStreamingRef.current = false;
              
              // Try to reconnect after 5 seconds
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log("[useWalletBalance] 🔄 Attempting to reconnect stream...");
                setupStream();
              }, 5000);
            },
          });

        streamCloseRef.current = closeStream;
        console.log("[useWalletBalance] 📡 Stream established successfully");
      } catch (error) {
        console.error("[useWalletBalance] Failed to setup stream:", error);
        isStreamingRef.current = false;
      }
    };

    // Setup the stream
    setupStream();

    // Setup fallback polling as backup (in case streaming fails)
    fallbackIntervalRef.current = setInterval(() => {
      // Only poll if streaming seems to be inactive
      if (!isStreamingRef.current) {
        console.log("[useWalletBalance] 🔄 Fallback poll - streaming inactive");
        void updateBalance();
      }
    }, FALLBACK_POLL_INTERVAL);

    // Cleanup on unmount or when address/network changes
    return () => {
      console.log("[useWalletBalance] 🧹 Cleaning up stream and intervals");
      
      if (streamCloseRef.current) {
        streamCloseRef.current();
        streamCloseRef.current = null;
      }
      
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      isStreamingRef.current = false;
    };
  }, [address, network, updateBalance]);

  return {
    ...state,
    updateBalance,
  };
};
