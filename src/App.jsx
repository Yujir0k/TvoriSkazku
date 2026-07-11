import React, { useState, useEffect } from 'react';
import { AuthGuard } from './AuthContext.jsx';
import Header from './components/Header';
import Footer from './components/Footer';
import SplashIntro from './components/SplashIntro';

// Импорт страниц
import Home from './pages/Home';
import StoryCreator from './pages/StoryCreator';
import StoryCharacters from './pages/StoryCharacters';
import BookCreationPrinting from './pages/BookCreationPrinting';
import Pricing from './pages/Pricing';
import TalesLibrary from './pages/TalesLibrary';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Account from './pages/Account';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import StoryEditor from './pages/StoryEditor';
import StoryScenes from './pages/StoryScenes';
import DataPolicy from './pages/DataPolicy';

function normalizePath(path) {
  // Алиасы: /login -> /sign-in, /register -> /sign-up
  const aliases = {
    '/login': '/sign-in',
    '/register': '/sign-up',
  };
  return aliases[path] || path;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(getPathname(window.location.pathname + window.location.search + window.location.hash));
      if (window.location.hash !== '#faq') {
        window.scrollTo(0, 0);
      }
    };

    // Слушаем события изменения истории браузера
    window.addEventListener('popstate', handleLocationChange);
    
    // Перехватываем клики по ссылкам для SPA-переходов
    const handleLinkClick = (e) => {
      if (e.defaultPrevented) return;
      const target = e.target.closest('a');
      if (target && target.href && target.target !== '_blank') {
        const url = new URL(target.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          navigate(`${url.pathname}${url.search}${url.hash}`);
        }
      }
    };
    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  const getPathname = (path) => {
    const normalized = normalizePath(path);
    return normalized.split(/[?#]/)[0] || '/';
  };

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(getPathname(path));
    if (!String(path).includes('#')) {
      window.scrollTo(0, 0);
    }
  };

  // Функция для рендеринга текущей страницы
  const renderPage = () => {
    // Приватные страницы, требующие авторизации
    // Приватные страницы, требующие авторизации
    if (currentPath === '/account') {
      return (
        <AuthGuard redirectTo="/sign-in" navigate={navigate}>
          <Account navigate={navigate} />
        </AuthGuard>
      );
    }

    if (currentPath === '/story-creator') {
      return (
        <AuthGuard redirectTo="/sign-in" navigate={navigate}>
          <StoryCreator navigate={navigate} />
        </AuthGuard>
      );
    }

    switch (currentPath) {
      case '/':
        return <Home navigate={navigate} />;

      case '/story-characters':
        return (
          <AuthGuard redirectTo="/sign-in" navigate={navigate}>
            <StoryCharacters navigate={navigate} />
          </AuthGuard>
        );
      case '/book-creation-printing':
        return <BookCreationPrinting navigate={navigate} />;
      case '/pricing':
        return <Pricing navigate={navigate} />;
      case '/privacy':
      case '/data-policy':
        return <DataPolicy navigate={navigate} />;
      case '/tvoriskazku-tales':
        return (
          <AuthGuard redirectTo="/sign-in" navigate={navigate}>
            <TalesLibrary navigate={navigate} />
          </AuthGuard>
        );
      case '/sign-in':
        return <SignIn navigate={navigate} />;
      case '/sign-up':
        return <SignUp navigate={navigate} />;
      case '/verify-email':
        return <VerifyEmail navigate={navigate} />;
      case '/forgot-password':
        return <ForgotPassword navigate={navigate} />;
      case '/story-editor':
        return (
          <AuthGuard redirectTo="/sign-in" navigate={navigate}>
            <StoryEditor navigate={navigate} />
          </AuthGuard>
        );
      case '/story-scenes':
        return (
          <AuthGuard redirectTo="/sign-in" navigate={navigate}>
            <StoryScenes navigate={navigate} />
          </AuthGuard>
        );
      case '/reset-password':
        return <ResetPassword navigate={navigate} />;
      default:
        return <Home navigate={navigate} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <SplashIntro />

      {/* Header */}
      <Header currentPath={currentPath} navigate={navigate} />

      {/* Основной контент */}
      <main className="flex-grow">
        {renderPage()}
      </main>

      {/* Footer */}
      <Footer navigate={navigate} />
    </div>
  );
}
