"use client";

// Wallet stack for Cookie Chain. Nightly is the primary (fully supported per explorer docs);
// Wallet-Standard auto-detect in wallet-adapter-react 0.15 catches other standard wallets too.
// ConnectionProvider points at rpc.cookiescan.io (commitment "confirmed") — chain selection is
// purely RPC-URL driven (no chain id). Users add Cookie Chain as a custom network inside Nightly
// (exact values in the NightlySetupModal).

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-nightly";
import { COMMITMENT, RPC_URL } from "@/lib/constants";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = RPC_URL;
  // NightlyWalletAdapter v0.1.20 takes no constructor config; network selection happens inside the
  // wallet UI (the user points Nightly at the Cookie Chain network they added).
  const wallets = useMemo(() => [new NightlyWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: COMMITMENT }}>
      <AdapterWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}
