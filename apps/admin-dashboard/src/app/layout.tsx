import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "CryptoWallet Admin Dashboard",
  description: "Secure administrative operations portal for CryptoWallet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ colorScheme: 'light' }}>
      <body className="min-h-full flex flex-col antialiased selection:bg-[#EC2629] selection:text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
