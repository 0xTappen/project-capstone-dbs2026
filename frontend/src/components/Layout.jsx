import { Outlet, NavLink } from 'react-router-dom';
import { Home, ListOrdered, FileText, PieChart, Settings, Target, BotMessageSquare } from 'lucide-react';

export default function Layout() {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/transactions', label: 'Transaksi', icon: ListOrdered },
    { path: '/budget', label: 'Anggaran', icon: Target },
    { path: '/bills', label: 'Tagihan', icon: FileText },
    { path: '/reports', label: 'Laporan', icon: PieChart },
    { path: '/chatbot', label: 'AI Advisor', icon: BotMessageSquare },
    { path: '/settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
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
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-white -z-10" />
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around px-2 py-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-300 ${
                  isActive 
                  ? 'text-emerald-600 scale-110' 
                  : 'text-gray-400 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
