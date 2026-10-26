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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-legal-bg text-white antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: '!bg-navy-700 !text-white !border !border-navy-500',
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
