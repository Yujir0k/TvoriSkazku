import React, { useState, useEffect } from 'react';
import { User, Mail, Edit3, LogOut, Trash2, RefreshCw, Smartphone, Crown, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { resendVerification, getSessions, deleteSession, getMyTariff } from '../api.js';

export default function Account({ navigate }) {
  const { user, loading, signOut, signOutAll, deleteAccount, updateName, fetchUser } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resending, setResending] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [tariff, setTariff] = useState(null);
  const [tariffLoading, setTariffLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/sign-in');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      getMyTariff()
        .then((data) => setTariff(data))
        .catch(() => {})
        .finally(() => setTariffLoading(false));
    }
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-24 text-text-secondary">Загрузка...</div>;
  }

  if (!user) {
    return null;
  }

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await updateName(newName.trim());
      setEditingName(false);
      setSuccess('Имя обновлено');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    try {
      await resendVerification();
      setSuccess('Письмо отправлено! Проверьте почту.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleSignOutAll = async () => {
    if (!window.confirm('Вы уверены, что хотите выйти со всех устройств?')) return;
    await signOutAll();
    navigate('/sign-in');
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await getSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      // Игнорируем ошибки загрузки сессий
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setSuccess('Сессия завершена');
      setTimeout(() => setSuccess(''), 3000);
      // После удаления сессии проверяем, не была ли это текущая сессия
      await fetchUser();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.')) return;
    if (!window.confirm('Все ваши данные будут безвозвратно удалены. Продолжить?')) return;
    await deleteAccount();
    navigate('/');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-16 md:py-24 flex items-center justify-center">
      <div className="w-full max-w-[580px] bg-white border border-border-light rounded-panel shadow-warm-md overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent"></div>
        <div className="p-8 md:p-10 flex flex-col">
          <div className="text-center mb-8">
            <h1 className="font-title text-3xl md:text-4xl font-bold text-title">Аккаунт</h1>
          </div>

          {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 py-2 px-4 rounded-xl">{error}</p>}
          {success && <p className="text-green-600 text-sm text-center mb-4 bg-green-50 py-2 px-4 rounded-xl">{success}</p>}

          {/* User info */}
          <div className="bg-warm-inner/60 border border-border-light/60 rounded-inner p-5 mb-4">
            {editingName ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="w-full max-w-sm flex flex-col gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary/60">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-border-light rounded-xl text-sm text-text outline-none focus:border-accent transition-colors shadow-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdateName} disabled={saving} className="flex-1 py-2.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-sm shadow-warm-soft transition-colors">
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button onClick={() => { setEditingName(false); setNewName(''); }} className="flex-1 py-2.5 rounded-full border border-border-light text-text-secondary hover:text-text hover:bg-warm-inner font-semibold text-sm transition-colors">
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-title text-xl truncate">{user.name}</span>
                      <button
                        type="button"
                        onClick={() => { setNewName(user.name); setEditingName(true); }}
                        aria-label="Изменить имя"
                        title="Изменить имя"
                        className="w-8 h-8 rounded-full bg-warm-inner border border-border-light flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors shrink-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email verification status */}
            <div className="border-t border-border-light/60 pt-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Статус email:{' '}
                  {user.emailVerified ? (
                    <span className="text-green-600 font-semibold">Подтверждён</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Не подтверждён</span>
                  )}
                </span>
                {!user.emailVerified && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-hover disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Отправка...' : 'Отправить повторно'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tariff & Limits */}
          {!tariffLoading && tariff && (
            <div className="bg-warm-inner/60 border border-border-light/60 rounded-inner p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Тариф: {tariff.plan.name}
                </span>
                {!tariff.enforcement && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Лимиты не активны</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {tariff.usage && [
                  { key: 'textGenerations', label: 'Генерации текста', fmt: (v) => String(v) },
                  { key: 'childProfiles', label: 'Профили детей', fmt: (v) => String(v) },
                  { key: 'characters', label: 'Персонажи', fmt: (v) => String(v) },
                  { key: 'illustrations', label: 'Иллюстрации', fmt: (v) => String(v) },
                  { key: 'pdfBooks', label: 'PDF-книги', fmt: (v) => String(v) },
                  { key: 'storageBytes', label: 'Хранилище', fmt: (v) => {
                    if (v >= 1073741824) return (v / 1073741824).toFixed(1) + ' GB';
                    if (v >= 1048576) return (v / 1048576).toFixed(1) + ' MB';
                    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
                    return v + ' B';
                  }},
                ].map(({ key, label, fmt }) => {
                  const used = tariff.usage[key] || 0;
                  const limit = tariff.limits[key];
                  if (typeof limit === 'boolean') {
                    if (!limit) return (
                      <div key={key} className="text-text-secondary">
                        <span>{label}: </span>
                        <span className="text-red-400">—</span>
                      </div>
                    );
                    return null;
                  }
                  const remain = tariff.remaining[key];
                  return (
                    <div key={key} className={remain <= 0 ? 'text-red-500 font-semibold' : 'text-text-secondary'}>
                      <span>{label}: </span>
                      <span>{fmt(used)}/{limit === 999999 ? '∞' : fmt(limit)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="bg-warm-inner/60 border border-border-light/60 rounded-inner p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Активные сессии</span>
                {sessionsLoading && <span className="text-xs text-text-secondary">Загрузка...</span>}
              </div>
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <div key={s.sessionId} className="flex items-center justify-between py-2 px-3 bg-white/50 rounded-xl border border-border-light/50">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-text-secondary" />
                      <span className="text-sm text-text-secondary">
                        {new Date(s.lastSeenAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteSession(s.sessionId)}
                      className="text-xs font-bold text-red-400 hover:text-red-500 transition-colors"
                    >
                      Завершить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button onClick={handleSignOutAll} className="w-full py-3 rounded-full border border-border-light text-title font-semibold text-sm hover:bg-warm-inner transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              Выйти со всех устройств
            </button>
            <button onClick={async () => { await signOut(); navigate('/'); }} className="w-full py-3 rounded-full border border-border-light text-title font-semibold text-sm hover:bg-warm-inner transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
            <button onClick={handleDeleteAccount} className="w-full py-3 rounded-full border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" />
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
