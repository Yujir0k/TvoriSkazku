import React, { useState, useEffect } from 'react';
import { Mail, LockKeyhole, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';

export default function SignIn({ navigate }) {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-16 md:py-24 flex items-center justify-center">
      <div className="w-full max-w-[580px] bg-white border border-border-light rounded-panel shadow-warm-md overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent"></div>
        <div className="p-8 md:p-10 flex flex-col">
          <div className="text-center mb-8">
            <h1 className="font-title text-3xl md:text-4xl font-bold text-title">Вход</h1>
            <p className="text-sm text-text mt-2">Войдите, чтобы сохранить сказки, озвучки и персонажей.</p>
          </div>

          <div className="bg-warm-inner/60 border border-border-light/60 rounded-inner p-5 mb-6">
            <span className="block text-center text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Быстрый вход</span>
            <div className="flex flex-col gap-3">
              <button disabled className="w-full py-3 px-4 bg-white border border-border-light rounded-full flex items-center justify-center gap-2.5 text-sm font-bold text-text-secondary shadow-sm opacity-60 cursor-not-allowed"
                title="Будет доступно после запуска сервиса"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#fc3f1d" />
                  <path d="M12.82 15.45c-.35.75-.75 1.25-1.2 1.55-.45.3-1 .45-1.65.45H8.5v-2.1h1.3c.35 0 .62-.07.82-.22.2-.15.38-.43.53-.83l.15-.45-2.8-6.85h2.25l1.6 4.35 1.55-4.35h2.15l-4.48 8.5z" fill="white" />
                </svg>
                Войти через Яндекс
              </button>
              <button disabled className="w-full py-3 px-4 bg-[#0b84ff] rounded-full flex items-center justify-center gap-2.5 text-sm font-bold text-white shadow-sm opacity-60 cursor-not-allowed"
                title="Будет доступно после запуска сервиса"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.83 11.59c.48.47.99.91 1.43 1.4.23.25.45.51.63.8.24.39.13.81-.26.85h-2.1c-.61.01-1.1-.23-1.52-.68-.31-.33-.6-.68-.91-1.01-.13-.14-.27-.27-.45-.35-.31-.14-.57-.04-.74.26-.17.3-.22.63-.24.96-.03.4-.17.53-.57.54-1.14.03-2.22-.21-3.22-.79-.89-.52-1.61-1.24-2.21-2.09-.99-1.4-1.68-2.94-2.25-4.55-.12-.34-.01-.51.35-.52h2.1c.26 0 .46.11.56.36.39.94.89 1.82 1.5 2.64.14.19.29.38.5.49.24.13.43.05.53-.22.09-.25.13-.51.14-.78.02-.78-.13-1.14-.58-1.27-.22-.06-.17-.16-.07-.24.21-.17.5-.23.8-.23h1.65c.34.01.46.15.49.49.08.83.04 1.66-.1 2.48-.04.24-.11.49.04.71.13.19.33.21.51.1.4-.24.71-.59.98-.97.54-.76.95-1.6 1.28-2.49.09-.24.24-.38.51-.38h2.1c.08 0 .17 0 .25.02.34.07.42.23.32.55-.24.77-.61 1.48-1.07 2.14-.34.49-.74.93-1.16 1.35-.29.29-.29.46.02.75z" />
                </svg>
                Войти через ВКонтакте
              </button>
              <p className="text-center text-xs text-text-secondary mt-1">Будет доступно после запуска сервиса</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border-soft"></div>
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">или email</span>
            <div className="flex-1 h-px bg-border-soft"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary/60">
                  <Mail className="w-5 h-5" />
                </div>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yourname@example.com" className="w-full pl-11 pr-4 py-3 bg-warm-inner/20 border border-border-light rounded-xl text-sm text-text outline-none focus:border-accent transition-colors shadow-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Пароль</label>
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs font-bold text-accent hover:text-accent-hover transition-colors">Забыли пароль?</button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary/60">
                  <LockKeyhole className="w-5 h-5" />
                </div>
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-11 pr-12 py-3 bg-warm-inner/20 border border-border-light rounded-xl text-sm text-text outline-none focus:border-accent transition-colors shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary/60 hover:text-text-secondary transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full mt-4 py-3.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-sm shadow-warm-soft transition-colors flex items-center justify-center gap-2">
              {loading ? 'Загрузка...' : 'Войти'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="text-center mt-8">
            <span className="text-sm text-text-secondary">
              Нет аккаунта?{' '}
              <button onClick={() => navigate('/sign-up')} className="font-bold text-accent hover:text-accent-hover transition-colors">
                Зарегистрироваться
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
