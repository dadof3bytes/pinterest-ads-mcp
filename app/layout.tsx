import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pinterest Ads MCP",
  description: "Single-tenant MCP server for Pinterest Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
