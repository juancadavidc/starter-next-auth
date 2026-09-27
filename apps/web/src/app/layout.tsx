import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "starter-next-auth", template: "%s · starter-next-auth" },
  description: "Una idea nueva, con login de Google desde el primer día.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
