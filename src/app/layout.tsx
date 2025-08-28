import type { Metadata } from "next";
import { Bitter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ContractReviewProvider } from "@/contexts/ContractReviewContext";

const bitter = Bitter({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Auburn Contract Review System",
  description: "Enterprise AI-powered contract compliance and review platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${bitter.className} h-full antialiased`}>
        <ContractReviewProvider>
          {children}
        </ContractReviewProvider>
        <Toaster />
      </body>
    </html>
  );
}
