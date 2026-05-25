import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, ListOrdered, FileText, PieChart, Settings, Target, BotMessageSquare, Grid2x2, X } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isChatbotPage = location.pathname.startsWith('/chatbot');

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/transactions', label: 'Transaksi', icon: ListOrdered },
    { path: '/budget', label: 'Anggaran', icon: Target },
    { path: '/bills', label: 'Tagihan', icon: FileText },
    { path: '/reports', label: 'Laporan', icon: PieChart },
    { path: '/chatbot', label: 'AI Advisor', icon: BotMessageSquare },
    { path: '/settings', label: 'Pengaturan', icon: Settings },
  ];

  const mobileMainItems = navItems.filter((item) => ['/dashboard', '/transactions', '/budget', '/bills'].includes(item.path));
  const mobileMoreItems = navItems.filter((item) => ['/reports', '/chatbot', '/settings'].includes(item.path));
  const isMoreSectionActive = mobileMoreItems.some((item) => item.path === location.pathname);

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-emerald-600">Mindfase</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-5 h-5 mr-3" strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 relative md:pb-0 ${
          isChatbotPage ? 'overflow-hidden pb-0 md:overflow-y-auto' : 'overflow-y-auto pb-28 sm:pb-24'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-white -z-10 layout-bg-gradient" />
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 grid grid-cols-5 gap-1 px-2 py-2 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl">
        {mobileMainItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                  isActive 
                  ? 'text-emerald-600 scale-110' 
                  : 'text-gray-400 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] leading-none text-center ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
        <button
          onClick={() => setIsMoreOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
            isMoreSectionActive || isMoreOpen ? 'text-emerald-600 scale-110' : 'text-gray-400 hover:text-gray-900'
          }`}
        >
          <Grid2x2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] leading-none text-center font-medium">Lainnya</span>
        </button>
      </nav>

      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => setIsMoreOpen(false)} />
          <div className="absolute bottom-20 left-3 right-3 bg-white rounded-2xl border border-gray-200 shadow-xl p-3">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <p className="text-sm font-bold text-gray-700">Menu Lainnya</p>
              <button onClick={() => setIsMoreOpen(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isActive ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
