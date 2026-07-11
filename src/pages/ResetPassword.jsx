import React, { useState, useEffect } from 'react';
import { LockKeyhole, Eye, EyeOff, CheckCircle, ArrowRight } from 'lucide-react';
import { resetPassword } from '../api.js';

export default function ResetPassword({ navigate }) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('form'); // form | success | error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword({ token, password });
      setStatus('success');
      setMessage('Пароль успешно изменён! Теперь вы можете войти с новым паролем.');
    } catch (err) {
      setError(err.message || 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-16 md:py-24 flex items-center justify-center">
      <div className="w-full max-w-[580px] bg-white border border-border-light rounded-panel shadow-warm-md overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent"></div>
        <div className="p-8 md:p-10 flex flex-col">
          {status === 'success' ? (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="font-title text-2xl font-bold text-title mb-2">Пароль изменён</h1>
              <p className="text-text-secondary mb-6">{message}</p>
              <button onClick={() => navigate('/sign-in')} className="px-8 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-warm-soft transition-colors">
                Войти
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="font-title text-3xl md:text-4xl font-bold text-title">Новый пароль</h1>
                <p className="text-sm text-text mt-2">Придумайте новый пароль для вашего аккаунта.</p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Новый пароль</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-secondary/60">
                      <LockKeyhole className="w-5 h-5" />
                    </div>
                    <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" className="w-full pl-11 pr-12 py-3 bg-warm-inner/20 border border-border-light rounded-xl text-sm text-text outline-none focus:border-accent transition-colors shadow-sm" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary/60 hover:text-text-secondary transition-colors" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button type="submit" disabled={loading || !token} className="w-full mt-4 py-3.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-sm shadow-warm-soft transition-colors flex items-center justify-center gap-2">
                  {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
