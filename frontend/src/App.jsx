import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import api from './lib/api';

const PROFILE_COMPLETION_PATH = '/settings/profile';
const THEME_MODE_KEY = 'theme_mode';

function isProfileComplete(user) {
  return Boolean(user?.phone && String(user.phone).trim() && user?.address && String(user.address).trim());
}

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const isAuthenticated = Boolean(token);
  const location = useLocation();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let isActive = true;

    const checkProfileCompletion = async () => {
      if (!isAuthenticated) {
        if (isActive) setStatus('unauthenticated');
        return;
      }

      if (isActive) {
        setStatus('checking');
      }

      try {
        const response = await api.get('/auth/me');
        const complete = isProfileComplete(response.data?.user);

        if (!isActive) return;

        if (!complete) {
          setStatus('incomplete');
          return;
        }

        setStatus('ready');
      } catch (err) {
        if (!isActive) return;

        if (err.response?.status === 401) {
          setStatus('unauthenticated');
          return;
        }

        setStatus('ready');
      }
    };

    checkProfileCompletion();

    const handleProfileUpdated = () => {
      checkProfileCompletion();
    };

    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      isActive = false;
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'checking') {
    return <LoadingScreen statusText="Memverifikasi akun..." subtitle="Sedang memeriksa kelengkapan data profil Anda" />;
  }

  if (status === 'incomplete' && location.pathname !== PROFILE_COMPLETION_PATH) {
    return <Navigate to="/settings/profile?complete=1" state={{ from: location }} replace />;
  }

  return children;
};

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Bills = lazy(() => import('./pages/Bills'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const SettingsProfile = lazy(() => import('./pages/SettingsProfile'));
const SettingsPassword = lazy(() => import('./pages/SettingsPassword'));
const SettingsDevices = lazy(() => import('./pages/SettingsDevices'));
const SettingsCategories = lazy(() => import('./pages/SettingsCategories'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Budget = lazy(() => import('./pages/Budget'));
const AIChatbot = lazy(() => import('./pages/AIChatbot'));

function RouteFallback() {
  return <LoadingScreen statusText="Memuat halaman..." subtitle="Mengambil modul halaman yang Anda pilih" />;
}

function getThemeModeFromStorage() {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return getSystemTheme();
}

function applyThemeMode(mode) {
  const resolvedTheme = resolveTheme(mode);
  document.body.classList.toggle('dark-mode', resolvedTheme === 'dark');
  window.dispatchEvent(
    new CustomEvent('theme-changed', {
      detail: { mode, theme: resolvedTheme },
    })
  );
}

function AppRoutesWithTransition() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const isSameRoute =
      location.pathname === displayLocation.pathname && location.search === displayLocation.search;

    if (isSameRoute) return;

    const startTimer = setTimeout(() => {
      setIsTransitioning(true);
    }, 0);

    const endTimer = setTimeout(() => {
      setDisplayLocation(location);
      setIsTransitioning(false);
    }, 1000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [location, displayLocation.pathname, displayLocation.search]);

  if (isTransitioning) {
    return (
      <LoadingScreen
        statusText="Memuat halaman baru..."
        subtitle="Mohon tunggu sebentar, halaman sedang disiapkan"
      />
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes location={displayLocation}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="bills" element={<Bills />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/profile" element={<SettingsProfile />} />
          <Route path="settings/password" element={<SettingsPassword />} />
          <Route path="settings/devices" element={<SettingsDevices />} />
          <Route path="settings/categories" element={<SettingsCategories />} />
          <Route path="budget" element={<Budget />} />
          <Route path="chatbot" element={<AIChatbot />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let isActive = true;

    const syncThemeFromServer = async () => {
      applyThemeMode(getThemeModeFromStorage());

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await api.get('/settings');
        const serverTheme = String(response.data?.theme || '').trim().toLowerCase();
        if (!isActive) return;

        if (serverTheme === 'light' || serverTheme === 'dark' || serverTheme === 'system') {
          localStorage.setItem(THEME_MODE_KEY, serverTheme);
          applyThemeMode(serverTheme);
        }
      } catch {
        // Keep local preference when settings sync fails.
      }
    };

    syncThemeFromServer();

    const handleMediaChange = (event) => {
      if (getThemeModeFromStorage() === 'system') {
        document.body.classList.toggle('dark-mode', event.matches);
        window.dispatchEvent(
          new CustomEvent('theme-changed', {
            detail: { mode: 'system', theme: event.matches ? 'dark' : 'light' },
          })
        );
      }
    };

    const handleThemeModeUpdated = () => {
      applyThemeMode(getThemeModeFromStorage());
    };

    window.addEventListener('theme-mode-updated', handleThemeModeUpdated);
    window.addEventListener('storage', handleThemeModeUpdated);
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      isActive = false;
      window.removeEventListener('theme-mode-updated', handleThemeModeUpdated);
      window.removeEventListener('storage', handleThemeModeUpdated);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  return (
    <Router>
      <AppRoutesWithTransition />
    </Router>
  );
}

export default App;
