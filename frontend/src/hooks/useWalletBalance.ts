import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./useWallet";
import { fetchBalance, type Balance } from "../util/wallet";

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

export const useWalletBalance = () => {
  const { address } = useWallet();
  const [state, setState] = useState<WalletBalance>({
    balances: [],
    xlm: "-",
    isFunded: false,
    isLoading: false,
    error: null,
  });

  const updateBalance = useCallback(async () => {
    if (!address) {
      console.log("[useWalletBalance] No address, skipping balance fetch");
      return;
    }
    
    console.log("[useWalletBalance] Fetching balance for address:", address);
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const balances = await fetchBalance(address);
      console.log("[useWalletBalance] Fetched balances:", balances);
      
      const isFunded = checkFunding(balances);
      const native = balances.find(({ asset_type }) => asset_type === "native");
      console.log("[useWalletBalance] Native balance found:", native);
      
      const formattedXlm = native?.balance ? formatter.format(Number(native.balance)) : "-";
      console.log("[useWalletBalance] Formatted XLM:", formattedXlm);
      
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
  }, [address]);

  useEffect(() => {
    void updateBalance();
  }, [updateBalance]);

  return {
    ...state,
    updateBalance,
  };
};
