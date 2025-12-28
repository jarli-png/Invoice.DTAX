import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DTAX Invoice - Fakturasystem',
  description: 'Profesjonelt fakturasystem for skattetjenester',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
