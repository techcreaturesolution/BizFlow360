import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create your BizFlow Workspace | Register",
  description: "Register your business workspace and start streamlining your operations with BizFlow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="min-h-full flex flex-col text-slate-900 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
