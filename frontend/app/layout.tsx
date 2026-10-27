import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'LegalDesk AI — AI-Powered Legal Case Workspace',
  description:
    'AI-powered legal case management for Indian lawyers. Upload FIRs, charge sheets, judgments and get instant AI analysis with citations.',
  keywords: 'legal AI, Indian lawyer, case management, RAG, document analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F1F5F9] text-[#334155] antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: '!bg-[#0C1E36] !text-white !border !border-slate-700 shadow-xl',
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
