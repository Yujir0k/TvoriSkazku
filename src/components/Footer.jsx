import React from 'react';

export default function Footer({ navigate }) {
  return (
    <footer className="relative w-full bg-[#f4ead9] border-t border-border-light/80 pt-16 pb-8 mt-20">
      
      {/* Боковые цветы (абсолютное позиционирование) */}
      <div className="absolute left-0 bottom-0 w-[180px] md:w-[240px] lg:w-[320px] pointer-events-none select-none opacity-80 md:opacity-100">
        <img 
          src="/assets/footer-florals-left.webp" 
          alt="" 
          className="w-full h-auto object-contain origin-bottom-left"
        />
      </div>
      <div className="absolute right-0 bottom-0 w-[180px] md:w-[240px] lg:w-[320px] pointer-events-none select-none opacity-80 md:opacity-100">
        <img 
          src="/assets/footer-florals-right.webp" 
          alt="" 
          className="w-full h-auto object-contain origin-bottom-right"
        />
      </div>

      {/* Основной контент */}
      <div className="page-shell-wide relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 xl:gap-12 pb-12 border-b border-border-sep">
          
          {/* Первая колонка: Бренд */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <img 
                src="/assets/logo-bunny-cloak-alpha.png" 
                alt="ТвориСказку" 
                className="w-10 h-10 object-contain"
              />
              <span className="font-brand text-3xl text-title font-bold tracking-wide">ТвориСказку</span>
            </div>
            <p className="text-sm text-text leading-relaxed max-w-[260px]">
              Добрые аудиосказки для счастливого детства и спокойных семейных вечеров.
            </p>
            
            {/* Социальные иконки */}
            <div className="flex items-center gap-3 mt-2">
              <a href="#" className="w-9 h-9 rounded-full bg-white border border-border-light flex items-center justify-center text-text hover:text-accent hover:border-accent transition-all duration-200 shadow-sm" title="Telegram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.4 2.1a1 1 0 0 0-1.1-.2l-18 8a1 1 0 0 0-.1 1.8l4.9 2.3 2.9 6.1a1 1 0 0 0 1.8-.1l2.2-4.4 4.9 3.3a1 1 0 0 0 1.5-.6l3-15a1 1 0 0 0-.2-1zM6.1 11.1l11.8-5.3-8.6 7.6-3.2-2.3zm6.9 5.9l-1.4 2.8-.1-3.8 1.5 1z" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white border border-border-light flex items-center justify-center text-text hover:text-accent hover:border-accent transition-all duration-200 shadow-sm" title="ВКонтакте">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.68 3H8.32C4.28 3 3 4.28 3 8.32v7.36C3 19.72 4.28 21 8.32 21h7.36c4.04 0 5.32-1.28 5.32-5.32V8.32C21 4.28 19.72 3 15.68 3zm3.12 11.8c0 .32-.1.6-.3.84-.2.24-.5.36-.9.36h-1.44c-.48 0-.9-.16-1.26-.48-.36-.32-.72-.78-1.08-1.38-.36-.6-.68-1.02-.96-1.26-.28-.24-.54-.36-.78-.36-.12 0-.24.02-.36.06-.12.04-.22.12-.3.24-.08.12-.14.28-.18.48-.04.2-.06.46-.06.78v1.08c0 .32-.1.58-.3.78-.2.2-.5.3-.9.3h-.72c-.84 0-1.62-.24-2.34-.72-.72-.48-1.32-1.14-1.8-1.98-.48-.84-.9-1.8-1.26-2.88-.36-1.08-.62-2.16-.78-3.24 0-.32.1-.58.3-.78.2-.2.5-.3.9-.3h1.44c.36 0 .62.1.78.3.16.2.28.48.36.84.24.96.54 1.86.9 2.7.36.84.72 1.5 1.08 1.98.36.48.6.72.72.72.12 0 .22-.04.3-.12.08-.08.14-.22.18-.42.04-.2.06-.46.06-.78V9.36c0-.48-.12-.84-.36-1.08-.24-.24-.66-.32-1.26-.24.12-.36.36-.64.72-.84.36-.2.84-.3 1.44-.3h1.08c.4 0 .7.1.9.3.2.2.3.48.3.84v2.88c0 .24.02.44.06.6.04.16.1.28.18.36.08.08.18.12.3.12.12 0 .26-.06.42-.18.16-.12.36-.32.6-.6.24-.28.5-.66.78-1.14.28-.48.54-1.04.78-1.68.08-.24.2-.44.36-.6.16-.16.4-.24.72-.24h1.44c.4 0 .7.1.9.3.2.2.26.44.18.72-.16.64-.44 1.28-.84 1.92-.4.64-.84 1.24-1.32 1.8-.12.16-.2.28-.24.36-.04.08-.04.16 0 .24.04.08.12.18.24.3.12.12.3.28.54.48.24.2.5.46.78.78.28.32.54.68.78 1.08.24.4.36.84.36 1.32z" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white border border-border-light flex items-center justify-center text-text hover:text-accent hover:border-accent transition-all duration-200 shadow-sm" title="YouTube">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Вторая колонка: Сервис */}
          <div>
            <h4 className="font-title text-lg font-bold text-title mb-4">Сервис</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li>
                <button onClick={() => navigate('/story-creator')} className="text-text hover:text-accent transition-colors text-left">
                  Создать сказку
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/story-characters')} className="text-text hover:text-accent transition-colors text-left">
                  Персонажи
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/pricing')} className="text-text hover:text-accent transition-colors text-left">
                  Тарифы
                </button>
              </li>
            </ul>
          </div>

          {/* Третья колонка: Семье */}
          <div>
            <h4 className="font-title text-lg font-bold text-title mb-4">Семье</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li>
                <button onClick={() => navigate('/tvoriskazku-tales')} className="text-text hover:text-accent transition-colors text-left">
                  Сказки на ночь
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/tvoriskazku-tales')} className="text-text hover:text-accent transition-colors text-left">
                  Плейлисты
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/book-creation-printing')} className="text-text hover:text-accent transition-colors text-left">
                  PDF-книга
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/')} className="text-text hover:text-accent transition-colors text-left">
                  Безопасность
                </button>
              </li>
            </ul>
          </div>

          {/* Четвертая колонка: Аккаунт */}
          <div>
            <h4 className="font-title text-lg font-bold text-title mb-4">Аккаунт</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li>
                <button onClick={() => navigate('/sign-in')} className="text-text hover:text-accent transition-colors text-left">
                  Войти
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/sign-up')} className="text-text hover:text-accent transition-colors text-left">
                  Регистрация
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/sign-in')} className="text-text hover:text-accent transition-colors text-left">
                  VK ID
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/sign-in')} className="text-text hover:text-accent transition-colors text-left">
                  Яндекс ID
                </button>
              </li>
            </ul>
          </div>

          {/* Пятая колонка: Документы */}
          <div>
            <h4 className="font-title text-lg font-bold text-title mb-4">Документы</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li>
                <button onClick={() => navigate('/privacy')} className="text-text hover:text-accent transition-colors text-left">
                  Политика обработки данных
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/privacy')} className="text-text hover:text-accent transition-colors text-left">
                  Конфиденциальность
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/privacy')} className="text-text hover:text-accent transition-colors text-left">
                  Данные
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Копирайт */}
        <div className="pt-8 text-center relative z-10">
          <p className="text-xs text-text-secondary">
            © 2026 ТвориСказку. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
