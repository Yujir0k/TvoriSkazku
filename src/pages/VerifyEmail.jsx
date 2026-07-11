import React, { useState, useEffect, useRef } from 'react';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { verifyEmail } from '../api.js';

export default function VerifyEmail({ navigate }) {
  const { fetchUser } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) return;
    verificationStarted.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Отсутствует токен подтверждения');
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Email успешно подтверждён!');
        // Обновляем пользователя в контексте, чтобы emailVerified обновился
        fetchUser();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Не удалось подтвердить email');
      });
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-24 flex items-center justify-center">
      <div className="w-full max-w-[480px] bg-white border border-border-light rounded-panel shadow-warm-md overflow-hidden relative p-10 text-center">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent"></div>

        {status === 'loading' && (
          <>
            <Mail className="w-16 h-16 text-accent mx-auto mb-4 animate-pulse" />
            <h1 className="font-title text-2xl font-bold text-title mb-2">Подтверждение email</h1>
            <p className="text-text-secondary">Проверяем токен...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="font-title text-2xl font-bold text-title mb-2">Email подтверждён</h1>
            <p className="text-text-secondary mb-6">{message}</p>
            <button onClick={() => navigate('/')} className="px-8 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-warm-soft transition-colors">
              На главную
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="font-title text-2xl font-bold text-title mb-2">Ошибка подтверждения</h1>
            <p className="text-text-secondary mb-6">{message}</p>
            <button onClick={() => navigate('/')} className="px-8 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-warm-soft transition-colors">
              На главную
            </button>
          </>
        )}
      </div>
    </div>
  );
}
