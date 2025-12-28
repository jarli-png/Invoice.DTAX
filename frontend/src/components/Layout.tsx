'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/invoices', label: 'Fakturaer', icon: '📄' },
  { href: '/credit-notes', label: 'Kreditnotaer', icon: '📝' },
  { href: '/customers', label: 'Kunder', icon: '👥' },
  { href: '/products', label: 'Produkter', icon: '📦' },
  { href: '/orders', label: 'Ordrer', icon: '📥' },
  { href: '/payments', label: 'Betalinger', icon: '💳' },
  { href: '/reports', label: 'Rapporter', icon: '📈' },
  { href: '/settings', label: 'Innstillinger', icon: '⚙️' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className={`bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {!collapsed && <h1 className="text-xl font-bold">DTAX Invoice</h1>}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white p-1"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        
        <nav className="p-2">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 text-gray-400 hover:text-white w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <span>🚪</span>
            {!collapsed && <span>Logg ut</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
