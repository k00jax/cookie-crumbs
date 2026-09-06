import type { Metadata, Viewport } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import { SwrSettings } from "@/components/DataProvider";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

export const metadata: Metadata = {
  title: "CHIP — Cookie Chain Market Terminal",
  description:
    "Live Cookie Chain analytics: token heatmap, price history, pools and connected-wallet portfolio. Wallet: Nightly.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <SwrSettings>
          <WalletProvider>{children}</WalletProvider>
        </SwrSettings>
      </body>
    </html>
  );
}
