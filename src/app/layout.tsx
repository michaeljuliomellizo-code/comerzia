import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "COMERZIA — Gestión inteligente para el comercio moderno",
  description:
    "Todo tu comercio en un solo lugar: ventas, inventario, clientes y reportes en tiempo real. COMERZIA centraliza la gestión de tu negocio para que tomes mejores decisiones.",
  keywords: ["COMERZIA", "comercio", "POS", "inventario", "ventas", "gestión", "negocio"],
  authors: [{ name: "COMERZIA" }],
  icons: {
    icon: "/comerzia-logo.svg",
  },
  openGraph: {
    title: "COMERZIA — Gestión inteligente para el comercio moderno",
    description: "Todo tu comercio en un solo lugar.",
    siteName: "COMERZIA",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
