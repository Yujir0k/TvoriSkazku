import React, { useState, useEffect } from 'react';
import { Crown, Check, X } from 'lucide-react';
import { getTariffs } from '../api.js';

const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Первые сказки',
    description: 'бесплатно',
    price: 0,
    limits: {
      textGenerations: 1,
      childProfiles: 1,
      characters: 3,
      illustrations: 0,
      storageBytes: 10 * 1024 * 1024,
      pdfBooks: 0,
      audioGenerations: 999999,
    },
  },
  {
    id: 'family',
    name: 'Семейный',
    description: 'планируется',
    price: 399,
    limits: {
      textGenerations: 15,
      childProfiles: 3,
      characters: 10,
      illustrations: 10,
      storageBytes: 100 * 1024 * 1024,
      pdfBooks: 3,
      audioGenerations: 5,
    },
  },
  {
    id: 'premium',
    name: 'Премиум',
    description: 'скоро',
    price: 799,
    limits: {
      textGenerations: 999999,
      childProfiles: 6,
      characters: 30,
      illustrations: 50,
      storageBytes: 500 * 1024 * 1024,
      pdfBooks: 20,
      audioGenerations: 999999,
    },
  },
];

export default function Pricing({ navigate }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    let cancelled = false;
    getTariffs()
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-shell-wide py-12 md:py-16 lg:py-20">
      
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-16">
        
        {/* Левая колонка: Текст */}
        <div className="lg:col-span-5 flex flex-col">
          <span className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider">Тарифы</span>
          <h1 className="font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title mt-2 leading-tight">
            Подписка без лишней сложности
          </h1>
          <p className="text-sm md:text-base text-text mt-4 leading-relaxed">
            Начните бесплатно, чтобы познакомиться с сервисом. Создайте одну сказку — все голоса и озвучка уже доступны.
          </p>
        </div>

        {/* Правая колонка: Панель с короной */}
        <div className="lg:col-span-7 bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft">
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-warm-inner/40 border border-border-light/60 rounded-inner p-6">
            <div className="w-16 h-16 rounded-full bg-warm-peach flex items-center justify-center text-accent shrink-0 shadow-sm">
              <Crown className="w-8 h-8" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-title text-2xl font-bold text-title">Первая сказка бесплатно</h3>
              <p className="text-xs md:text-sm text-text mt-1 leading-relaxed">
                Попробуйте все возможности: один рассказ, все голоса, полная озвучка и скачивание.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Тарифные карточки */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch w-full mx-auto">
        {plans.map((plan) => {
          const isUpcoming = plan.id !== 'free';
          const isFree = plan.id === 'free';
          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden border rounded-card p-8 md:p-9 lg:p-10 min-h-[520px] flex flex-col justify-between shadow-warm-soft transition-all duration-300 ease-out ${
                plan.id === 'family'
                  ? 'bg-warm-inner border-2 border-accent md:-translate-y-3 hover:-translate-y-5 hover:shadow-warm-lg'
                  : 'bg-white border-border-light hover:-translate-y-2 hover:shadow-warm-lg hover:border-accent/40'
              }`}
            >
              {plan.id === 'family' && (
                <span className="absolute top-4 right-4 px-3 py-1 bg-accent/80 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">Скоро</span>
              )}
              <div>
                <h3 className="font-title text-3xl md:text-4xl font-bold text-title leading-tight pr-20 md:pr-0">{plan.name}</h3>
                <p className="text-sm text-text-secondary mt-1">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl md:text-6xl font-bold text-title tracking-tight">{plan.price === 0 ? '0 ₽' : plan.price + ' ₽'}</span>
                  {isUpcoming && <span className="text-xs text-text-secondary ml-1">в месяц</span>}
                </div>
                <ul className="mt-6 flex flex-col gap-3.5 text-base md:text-lg text-text">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Сказок: {plan.limits.textGenerations === 999999 ? '∞' : plan.limits.textGenerations}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Профилей: {plan.limits.childProfiles}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Персонажей: {plan.limits.characters}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Озвучка: {plan.limits.audioGenerations === 999999 ? '∞' : plan.limits.audioGenerations}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Голоса рассказчиков</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-5 h-5 text-accent shrink-0" />
                    <span>Скачивание MP3</span>
                  </li>
                </ul>
              </div>
              {isFree ? (
                <button onClick={() => navigate('/')} className="w-full mt-8 py-4 rounded-full border border-border-light hover:border-accent hover:text-accent hover:bg-white font-bold text-base transition-colors">
                  Создать сказку
                </button>
              ) : (
                <button disabled className="w-full mt-8 py-4 rounded-full bg-white/70 border border-border-light text-text-secondary font-bold text-base cursor-not-allowed">
                  Оформить подписку
                </button>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
