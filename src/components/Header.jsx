import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Menu, X, ChevronDown, User, Printer, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';

export default function Header({ currentPath, navigate }) {
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'create' | 'listen' | null
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = (type) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(type);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Закрываем меню при смене пути
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [currentPath]);

  const isCreateActive = ['/story-creator', '/story-characters', '/book-creation-printing'].includes(currentPath);

  const scrollToFaq = () => {
    let attempts = 0;

    const tryScroll = () => {
      const target = document.getElementById('faq');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      attempts += 1;
      if (attempts < 30) {
        window.setTimeout(tryScroll, 40);
      }
    };

    tryScroll();
  };

  const goToFaq = (event) => {
    event.preventDefault();
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);

    if (currentPath !== '/') {
      navigate('/#faq');
      window.setTimeout(scrollToFaq, 120);
      window.setTimeout(scrollToFaq, 360);
      return;
    }

    window.history.replaceState({}, '', '/#faq');
    scrollToFaq();
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-paper/80 border-b border-border-light/60 transition-all duration-300">
      <div className="page-shell-wide h-[88px] min-[2100px]:h-[100px] flex items-center justify-between relative">
        
        {/* Логотип */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-3 cursor-pointer select-none shrink-0"
        >
          <img 
            src="/assets/logo-bunny-cloak-alpha.png" 
            alt="ТвориСказку" 
            className="w-10 h-10 min-[2100px]:w-12 min-[2100px]:h-12 object-contain"
          />
          <span className="font-brand text-3xl min-[2100px]:text-4xl text-title font-bold tracking-wide">ТвориСказку</span>
        </div>

        {/* Центральная навигация (Desktop от 1180px) */}
        <nav className="wide-header-nav hidden min-[1180px]:flex items-center justify-center absolute left-1/2 -translate-x-1/2 bg-warm-inner/90 border border-border-soft rounded-full p-1.5 min-[2100px]:p-2 shadow-warm-soft">
          <div className="flex items-center gap-1">
            
            {/* Сказки (Главная) */}
            <button
              onClick={() => navigate('/')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                currentPath === '/'
                  ? 'bg-white text-accent shadow-sm font-bold'
                  : 'text-text hover:text-accent hover:bg-white hover:shadow-sm'
              }`}
            >
              Сказки
            </button>

            {/* Создать Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('create')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'create' ? null : 'create')}
                className={`px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1 transition-all duration-200 ${
                  isCreateActive
                    ? 'bg-white text-accent shadow-sm font-bold'
                    : activeDropdown === 'create'
                    ? 'bg-white text-accent shadow-sm font-bold'
                    : 'text-text hover:text-accent hover:bg-white hover:shadow-sm'
                }`}
              >
                Создать
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'create' ? 'rotate-180' : ''}`} />
              </button>

              {/* Выпадающее меню Создать */}
              {activeDropdown === 'create' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[360px] bg-card border border-border-light rounded-inner shadow-warm-md p-2 flex flex-col gap-1 z-50">
                  <div 
                    onClick={() => navigate('/story-creator')}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-warm-inner cursor-pointer transition-colors duration-150"
                  >
                    <div className="p-2 bg-warm-peach rounded-lg text-accent shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-title text-sm">Конструктор сказки</div>
                      <div className="text-xs text-text-secondary mt-0.5">Соберите идею, героев и озвучку</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => navigate('/story-characters')}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-warm-inner cursor-pointer transition-colors duration-150"
                  >
                    <div className="p-2 bg-warm-peach rounded-lg text-accent shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-title text-sm">Персонажи</div>
                      <div className="text-xs text-text-secondary mt-0.5">Профили детей, друзей и питомцев</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => navigate('/book-creation-printing')}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-warm-inner cursor-pointer transition-colors duration-150"
                  >
                    <div className="p-2 bg-warm-peach rounded-lg text-accent shrink-0">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-title text-sm">PDF-книга</div>
                      <div className="text-xs text-text-secondary mt-0.5">Скачайте PDF-макет сказки</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Библиотека */}
            <button
              onClick={() => navigate('/tvoriskazku-tales')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                currentPath === '/tvoriskazku-tales'
                  ? 'bg-white text-accent shadow-sm font-bold'
                  : 'text-text hover:text-accent hover:bg-white hover:shadow-sm'
              }`}
            >
              Библиотека
            </button>

            {/* Тарифы */}
            <button
              onClick={() => navigate('/pricing')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                currentPath === '/pricing'
                  ? 'bg-white text-accent shadow-sm font-bold'
                  : 'text-text hover:text-accent hover:bg-white hover:shadow-sm'
              }`}
            >
              Тарифы
            </button>

            {/* FAQ */}
            <a
              href="#faq"
              onClick={goToFaq}
              className="px-5 py-2 rounded-full text-sm font-semibold text-text hover:text-accent hover:bg-white hover:shadow-sm transition-all duration-200"
            >
              FAQ
            </a>

          </div>
        </nav>

{/* Правые кнопки (Desktop от 1180px) */}
        <div className="hidden min-[1180px]:flex items-center gap-4 shrink-0">
          {user ? (
            <>
              <button
                onClick={() => navigate('/account')}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-warm-inner border border-border-light text-title hover:text-accent transition-colors duration-200"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-semibold">{user.name}</span>
              </button>
              <button
                onClick={async () => { await signOut(); }}
                className="text-sm font-semibold text-text-secondary hover:text-accent transition-colors duration-200"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/sign-in')}
                className="text-sm font-semibold text-text hover:text-accent transition-colors duration-200"
              >
                Войти
              </button>
              <button
                onClick={() => navigate('/sign-up')}
                className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-warm-soft transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Sparkles className="w-4 h-4" />
                Попробовать
              </button>
            </>
          )}
        </div>

        {/* Кнопка мобильного меню (до 1179px) */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="min-[1180px]:hidden p-2.5 rounded-full bg-warm-inner border border-border-light text-title hover:text-accent transition-colors duration-200"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

      </div>

      {/* Мобильное меню (до 1179px) */}
      {isMobileMenuOpen && (
        <div className="min-[1180px]:hidden w-full bg-card border-b border-border-light shadow-warm-md animate-fadeIn">
          <div className="px-6 py-6 flex flex-col gap-4 max-h-[calc(100vh-88px)] overflow-y-auto">
            <button 
              onClick={() => navigate('/')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/' ? 'text-accent' : 'text-title'}`}
            >
              Сказки
            </button>
            <button 
              onClick={() => navigate('/story-creator')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/story-creator' ? 'text-accent' : 'text-title'}`}
            >
              Конструктор
            </button>
            <button 
              onClick={() => navigate('/story-characters')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/story-characters' ? 'text-accent' : 'text-title'}`}
            >
              Персонажи
            </button>
            <button 
              onClick={() => navigate('/book-creation-printing')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/book-creation-printing' ? 'text-accent' : 'text-title'}`}
            >
              PDF-книга
            </button>
            <button 
              onClick={() => navigate('/tvoriskazku-tales')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/tvoriskazku-tales' ? 'text-accent' : 'text-title'}`}
            >
              Библиотека
            </button>
            <button 
              onClick={() => navigate('/pricing')} 
              className={`text-left py-2.5 border-b border-border-soft/40 font-semibold text-base ${currentPath === '/pricing' ? 'text-accent' : 'text-title'}`}
            >
              Тарифы
            </button>
            <button
              onClick={goToFaq}
              className="text-left py-2.5 border-b border-border-soft/40 font-semibold text-base text-title hover:text-accent"
            >
              FAQ
            </button>
<div className="flex flex-col gap-3 pt-4">
              {user ? (
                <>
                  <button
                    onClick={() => navigate('/account')}
                    className="w-full py-3 rounded-full border border-border-light text-center font-semibold text-title hover:bg-warm-inner transition-colors duration-200"
                  >
                    <User className="w-4 h-4 inline mr-2" />
                    {user.name}
                  </button>
                  <button
                  onClick={async () => { await signOut(); }}
                  className="w-full py-3 rounded-full border border-red-200 text-red-500 text-center font-semibold hover:bg-red-50 transition-colors duration-200"                  >
                    <LogOut className="w-4 h-4 inline mr-2" />
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/sign-in')}
                    className="w-full py-3 rounded-full border border-border-light text-center font-semibold text-title hover:bg-warm-inner transition-colors duration-200"
                  >
                    Войти
                  </button>
                  <button
                    onClick={() => navigate('/sign-up')}
                    className="w-full py-3 rounded-full bg-accent hover:bg-accent-hover text-white text-center font-bold flex items-center justify-center gap-2 shadow-warm-soft transition-colors duration-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    Попробовать
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
