"use client";

// Wallet stack for Cookie Chain. Nightly is the primary (fully supported per explorer docs);
// Wallet-Standard auto-detect in wallet-adapter-react 0.15 catches other standard wallets too.
// ConnectionProvider points at rpc.cookiescan.io (commitment "confirmed") — chain selection is
// purely RPC-URL driven (no chain id). Users add Cookie Chain as a custom network inside Nightly
// (exact values in the NightlySetupModal).

import { useMemo } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-nightly";
import { COMMITMENT, RPC_URL } from "@/lib/constants";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = RPC_URL;
  // Nightly connects to whichever network the user has active inside the wallet UI; the app itself
  // always talks to Cookie Chain through its own Connection (reads, and later tx building). Passing
  // the standard Mainnet network value keeps the adapter's internal defaults benign for a custom SVM.
  const wallets = useMemo(
    () => [new NightlyWalletAdapter({ network: WalletAdapterNetwork.Mainnet })],
    [],
  );
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: COMMITMENT }}>
      <AdapterWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}
