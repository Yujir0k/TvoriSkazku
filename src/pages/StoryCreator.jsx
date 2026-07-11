import React from 'react';
import Generator from '../components/Generator';
import { Sparkles, Mic, Image, Baby, FileText } from 'lucide-react';

export default function StoryCreator({ navigate }) {
  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      
      {/* Верхний hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-12 md:mb-16">
        
        {/* Левая колонка: Текст */}
        <div className="lg:col-span-5 flex flex-col">
          <span className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider">Конструктор сказки</span>
          <h1 className="font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title mt-2 leading-tight">
            Создайте сказку как маленький проект
          </h1>
          <p className="text-sm md:text-base text-text mt-4 leading-relaxed">
            Отдельная вкладка для глубокого создания: идея, жанр, возрастная группа, озвучка, иллюстрации, главы и персонажи в одном спокойном интерфейсе.
          </p>
        </div>

        {/* Правая колонка: Сетка 2x2 */}
        <div className="lg:col-span-7 bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-warm-peach rounded-xl text-accent shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-title text-base">Черновик</h3>
                <p className="text-xs md:text-sm text-text-secondary mt-1">Сюжет за 30 секунд</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-warm-peach rounded-xl text-accent shrink-0">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-title text-base">Озвучка</h3>
                <p className="text-xs md:text-sm text-text-secondary mt-1">Голос мамы или студия</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-warm-peach rounded-xl text-accent shrink-0">
                <Image className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-title text-base">Картинки</h3>
                <p className="text-xs md:text-sm text-text-secondary mt-1">Акварельный стиль</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-warm-peach rounded-xl text-accent shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-title text-base">Возраст</h3>
                <p className="text-xs md:text-sm text-text-secondary mt-1">Лексика под ребенка</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Генератор */}
      <div className="mt-8">
        <Generator navigate={navigate} />
      </div>

    </div>
  );
}
