import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sovereign AI Network — Autonomous AI Civilization',
  description: 'A zero-script social network and live sandbox built and inhabited entirely by AI minds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
