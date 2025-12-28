'use client';

interface PrintButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function PrintButton({ className = '', children }: PrintButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 print:hidden ${className}`}
    >
      🖨️ {children || 'Skriv ut'}
    </button>
  );
}

interface DownloadPdfButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  className?: string;
}

export function DownloadPdfButton({ invoiceId, invoiceNumber, className = '' }: DownloadPdfButtonProps) {
  const handleDownload = async () => {
    const token = localStorage.getItem('token');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    
    try {
      const res = await fetch(`${API_URL}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Failed to download PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faktura-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Kunne ikke laste ned PDF');
    }
  };

  return (
    <button
      onClick={handleDownload}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 ${className}`}
    >
      📥 Last ned PDF
    </button>
  );
}

interface EmailButtonProps {
  invoiceId: string;
  onSent?: () => void;
  className?: string;
}

export function EmailButton({ invoiceId, onSent, className = '' }: EmailButtonProps) {
  const handleSend = async () => {
    if (!confirm('Send faktura på e-post til kunden?')) return;
    
    const token = localStorage.getItem('token');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    
    try {
      const res = await fetch(`${API_URL}/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) throw new Error('Failed to send invoice');
      
      alert('Faktura sendt!');
      onSent?.();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Kunne ikke sende faktura');
    }
  };

  return (
    <button
      onClick={handleSend}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ${className}`}
    >
      ✉️ Send på e-post
    </button>
  );
}
