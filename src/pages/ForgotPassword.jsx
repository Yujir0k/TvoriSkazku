import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../api.js';

export default function ForgotPassword({ navigate }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Ошибка');
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
            <h1 className="font-title text-3xl md:text-4xl font-bold text-title">Восстановление пароля</h1>
            <p className="text-sm text-text mt-2">Введите email, и мы отправим вам ссылку для сброса пароля.</p>
          </div>

          {sent ? (
            <div className="text-center">
              <Mail className="w-16 h-16 text-accent mx-auto mb-4" />
              <p className="text-text-secondary mb-6">
                Если пользователь с таким email существует, мы отправили письмо с инструкциями.
              </p>
              <button onClick={() => navigate('/sign-in')} className="font-bold text-accent hover:text-accent-hover transition-colors">
                Вернуться ко входу
              </button>
            </div>
          ) : (
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

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button type="submit" disabled={loading} className="w-full mt-4 py-3.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-sm shadow-warm-soft transition-colors flex items-center justify-center gap-2">
                {loading ? 'Отправка...' : 'Отправить'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button type="button" onClick={() => navigate('/sign-in')} className="text-center text-sm text-text-secondary hover:text-accent transition-colors flex items-center justify-center gap-1 mt-2">
                <ArrowLeft className="w-4 h-4" />
                Вернуться ко входу
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
