import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.scss";
import { notFound } from "next/navigation";
import { ReactNode } from "react";

// MAETRY: standalone UI preview, without login metadata or backend translations.
export default function PreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
