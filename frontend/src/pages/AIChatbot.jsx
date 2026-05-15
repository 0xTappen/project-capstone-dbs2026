import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import api from '../lib/api';
import AppDialog from '../components/AppDialog';
import { getProfileAvatarSrc } from '../lib/profileAvatar';

function mapHistory(messages = []) {
  return messages.map((item) => ({
    id: item.id,
    text: item.message,
    sender: item.role === 'assistant' ? 'ai' : 'user',
    createdAt: item.created_at,
  }));
}

function formatSessionTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AIChatbot() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: 'Pengguna', avatar_url: '' });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState('');

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [renameSessionTarget, setRenameSessionTarget] = useState(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async (preferSessionId = null) => {
    setLoadingSessions(true);
    try {
      const response = await api.get('/chatbot/sessions');
      const fetchedSessions = Array.isArray(response.data) ? response.data : [];

      if (fetchedSessions.length === 0) {
        const created = await api.post('/chatbot/sessions', { title: 'Chat Baru' });
        const newSession = created.data;
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        return newSession.id;
      }

      setSessions(fetchedSessions);

      const hasPreferred = preferSessionId && fetchedSessions.some((session) => session.id === preferSessionId);
      if (hasPreferred) {
        setActiveSessionId(preferSessionId);
        return preferSessionId;
      }

      if (activeSessionId && fetchedSessions.some((session) => session.id === activeSessionId)) {
        return activeSessionId;
      }

      setActiveSessionId(fetchedSessions[0].id);
      return fetchedSessions[0].id;
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat daftar chat.');
      return null;
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadHistory = async (sessionId) => {
    if (!sessionId) return;

    setLoadingMessages(true);
    try {
      const response = await api.get('/chatbot/history', { params: { session_id: sessionId } });
      const historyMessages = mapHistory(Array.isArray(response.data?.messages) ? response.data.messages : []);
      setMessages(historyMessages);
      if (response.data?.session?.id) {
        setActiveSessionId(response.data.session.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat riwayat chat.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setError('');
      try {
        const meResponse = await api.get('/auth/me');
        if (meResponse.data?.user) {
          setUserProfile({
            name: meResponse.data.user.name || 'Pengguna',
            avatar_url: meResponse.data.user.avatar_url || '',
          });
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data pengguna.');
      } finally {
        const sessionId = await loadSessions();
        if (sessionId) {
          await loadHistory(sessionId);
        }
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileSidebarOpen]);

  const handleCreateSession = async () => {
    setError('');
    setIsCreatingSession(true);

    try {
      const response = await api.post('/chatbot/sessions', { title: 'Chat Baru' });
      const newSession = response.data;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setInput('');
      setIsMobileSidebarOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuat chat baru.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (sessionId === activeSessionId) {
      setIsMobileSidebarOpen(false);
      return;
    }

    setError('');
    setActiveSessionId(sessionId);
    setIsMobileSidebarOpen(false);
    await loadHistory(sessionId);
  };

  const handleRenameSession = (session) => {
    setRenameSessionTarget(session);
  };

  const confirmRenameSession = async (nextTitle) => {
    if (!renameSessionTarget) return;

    const title = String(nextTitle || '').trim();
    if (!title) return;

    try {
      const response = await api.patch(`/chatbot/sessions/${renameSessionTarget.id}`, { title });
      setSessions((prev) =>
        prev.map((item) => (item.id === renameSessionTarget.id ? { ...item, ...response.data } : item))
      );
      setRenameSessionTarget(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengubah judul chat.');
    }
  };

  const handleDeleteSession = (session) => {
    setDeleteSessionTarget(session);
  };

  const confirmDeleteSession = async () => {
    if (!deleteSessionTarget) return;
    setError('');

    try {
      await api.delete(`/chatbot/sessions/${deleteSessionTarget.id}`);

      const remaining = sessions.filter((item) => item.id !== deleteSessionTarget.id);
      setSessions(remaining);
      setDeleteSessionTarget(null);

      if (remaining.length === 0) {
        const created = await api.post('/chatbot/sessions', { title: 'Chat Baru' });
        const newSession = created.data;
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        return;
      }

      if (activeSessionId === deleteSessionTarget.id) {
        const nextSessionId = remaining[0].id;
        setActiveSessionId(nextSessionId);
        await loadHistory(nextSessionId);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus chat.');
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!input.trim() || !activeSessionId) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, text: userMessage, sender: 'user', createdAt: new Date().toISOString() },
    ]);
    setInput('');
    setIsTyping(true);
    setError('');

    try {
      const response = await api.post('/chatbot', {
        session_id: activeSessionId,
        message: userMessage,
      });

      const reply = response.data?.reply || 'Maaf, saya belum bisa memberikan respons saat ini.';
      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, text: reply, sender: 'ai', createdAt: new Date().toISOString() },
      ]);

      await loadSessions(activeSessionId);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghubungi AI advisor.');
    } finally {
      setIsTyping(false);
    }
  };

  const renderSidebar = () => (
    <>
      <button
        onClick={handleCreateSession}
        disabled={isCreatingSession}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-60"
      >
        <Plus className="w-5 h-5" />
        {isCreatingSession ? 'Membuat...' : 'New Chat'}
      </button>

      <div className="mt-4 overflow-y-auto space-y-2 pr-1 no-scrollbar">
        {loadingSessions && <p className="text-sm text-gray-500 font-medium">Memuat chat...</p>}
        {!loadingSessions && sessions.length === 0 && (
          <p className="text-sm text-gray-500 font-medium">Belum ada riwayat chat.</p>
        )}

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;

          return (
            <div
              key={session.id}
              className={`rounded-xl border p-3 cursor-pointer transition ${isActive ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              onClick={() => handleSelectSession(session.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{session.title || 'Chat Baru'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{session.last_message || 'Belum ada pesan'}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatSessionTime(session.updated_at)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRenameSession(session);
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSession(session);
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="p-0 md:p-6 max-w-7xl mx-auto h-[calc(100dvh-72px)] md:h-[calc(100vh-72px)] relative">
      <div className="h-full flex gap-4">
        {isDesktopSidebarOpen && (
          <aside className="hidden md:flex w-[300px] bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 flex-col overflow-hidden">
            {renderSidebar()}
          </aside>
        )}

        <section className="flex-1 bg-white rounded-none md:rounded-3xl border-0 md:border border-gray-100 shadow-none md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden">
          <header className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
                className="hidden md:inline-flex p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {isDesktopSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </button>

              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">AI Financial Advisor</h1>
              </div>
            </div>
          </header>

          {error && <p className="px-6 pt-4 text-sm text-red-600 font-bold">{error}</p>}

          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 space-y-4">
            {loadingMessages ? (
              <div className="h-full flex items-center justify-center text-gray-500 font-bold">Memuat riwayat percakapan...</div>
            ) : messages.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-gray-500">
                <MessageSquare className="w-10 h-10 mb-3 text-gray-300" />
                <p className="font-bold">Belum ada pesan di chat ini.</p>
                <p className="text-sm">Mulai percakapan baru di bawah.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-full sm:max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                    {msg.sender === 'user' ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm border border-emerald-300 bg-emerald-50">
                        <img
                          src={getProfileAvatarSrc(userProfile)}
                          alt={userProfile.name || 'User'}
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = getProfileAvatarSrc({ name: userProfile.name, avatar_url: '' });
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        <Bot className="w-5 h-5" />
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      <p className="whitespace-pre-wrap font-medium leading-relaxed text-sm md:text-base">{msg.text}</p>
                    </div>
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex flex-row items-end gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-sm flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 md:p-6 border-t border-gray-100">
            <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Tulis pesan..."
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none p-4 font-medium transition"
                />
              <button
                type="submit"
                disabled={!input.trim() || isTyping || !activeSessionId}
                className="bg-emerald-600 text-white px-5 md:px-6 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-200"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </section>
      </div>

      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/40" onClick={() => setIsMobileSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86vw] max-w-sm bg-white border-r border-gray-200 shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Riwayat Chat</h2>
              <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebar()}
          </aside>
        </div>
      )}

      <AppDialog
        open={Boolean(renameSessionTarget)}
        variant="prompt"
        title="Ubah Judul Chat"
        description="Masukkan judul baru untuk percakapan ini."
        defaultValue={renameSessionTarget?.title || 'Chat Baru'}
        placeholder="Contoh: Rencana Keuangan Bulanan"
        confirmText="Simpan"
        cancelText="Batal"
        onCancel={() => setRenameSessionTarget(null)}
        onConfirm={confirmRenameSession}
      />

      <AppDialog
        open={Boolean(deleteSessionTarget)}
        title="Hapus Chat?"
        description={`Chat "${deleteSessionTarget?.title || 'Tanpa judul'}" akan dihapus permanen.`}
        confirmText="Hapus"
        cancelText="Batal"
        danger
        onCancel={() => setDeleteSessionTarget(null)}
        onConfirm={confirmDeleteSession}
      />

    </div>
  );
}
