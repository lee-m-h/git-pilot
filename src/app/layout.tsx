import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Git Pilot",
  description: "Multi-repository Git management dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
