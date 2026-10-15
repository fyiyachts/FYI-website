import type { ReactNode } from 'react';
import NavBar from './NavBar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-yacht-900">
      <NavBar />
      {/* Main content offset for sidebar on desktop */}
      <div className="md:ml-[220px] min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-white/10 py-6 px-6 text-center">
          <p className="text-[11px] font-light tracking-wider text-white/30">
            &copy; {new Date().getFullYear()} Florida Yachts International
          </p>
        </footer>
      </div>
    </div>
  );
}
