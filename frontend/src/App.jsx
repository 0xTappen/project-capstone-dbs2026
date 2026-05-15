import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout';
import api from './lib/api';

const PROFILE_COMPLETION_PATH = '/settings/profile';

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

      try {
        const response = await api.get('/auth/me');
        const complete = isProfileComplete(response.data?.user);

        if (!isActive) return;

        if (!complete && location.pathname !== PROFILE_COMPLETION_PATH) {
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

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, location.pathname]);

  if (!isAuthenticated || status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-gray-500">
        Memuat halaman...
      </div>
    );
  }

  if (status === 'incomplete') {
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
  return (
    <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-gray-500">
      Memuat halaman...
    </div>
  );
}

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
  }, []);

  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
    </Router>
  );
}

export default App;
