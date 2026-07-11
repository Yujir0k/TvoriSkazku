import React from 'react';
import { CheckCircle2, Shield, Trash2 } from 'lucide-react';

const processingRows = [
  {
    data: 'Имя или никнейм, email, пароль в виде хеша, данные сессии и cookie авторизации',
    goal: 'Регистрация, вход в аккаунт, защита сессии и восстановление доступа',
  },
  {
    data: 'Возрастная группа ребёнка, выбранные готовые аватары, персонажи и настройки сказки',
    goal: 'Создание персонализированной сказки без точного возраста, фотографий и документов',
  },
  {
    data: 'Идея сказки, сгенерированный текст, выбранный голос рассказчика, PDF и MP3-файлы',
    goal: 'Генерация текста, озвучки готовыми голосами, PDF-книги и хранение результата в библиотеке',
  },
  {
    data: 'Технические данные: IP-адрес, user-agent, время запроса, ошибки без сырого текста пользователя',
    goal: 'Безопасность сервиса, диагностика сбоев, защита от злоупотреблений',
  },
];

const forbiddenItems = [
  'паспорт, серия и номер документа, код подразделения, сведения о выдаче документа',
  'СНИЛС, ИНН, банковские реквизиты и данные оплаты',
  'адрес проживания, телефон, email ребёнка или третьих лиц и другие реальные контактные данные',
  'фамилия ребёнка, школа или детский сад, документы, медицинские сведения',
  'точная дата рождения и иные чувствительные данные',
];

const processingActions = [
  'сбор',
  'запись',
  'систематизация',
  'накопление',
  'хранение',
  'уточнение',
  'использование',
  'передача техническим сервисам генерации после фильтра персональных данных',
  'блокирование',
  'удаление',
  'уничтожение',
  'обезличивание',
];

export default function DataPolicy({ navigate }) {
  return (
    <div className="page-shell-wide py-12 md:py-16 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <span className="text-xs font-bold uppercase tracking-wider text-accent md:text-sm">
          Документы
        </span>
        <h1 className="mt-3 font-title text-4xl font-bold leading-tight text-title md:text-5xl">
          Согласие на обработку персональных данных
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-text md:text-lg">
          Нажимая кнопку регистрации и отмечая чекбокс согласия, пользователь подтверждает,
          что является родителем или законным представителем, ознакомился с настоящим согласием
          и политикой обработки данных и даёт согласие на обработку персональных данных,
          необходимых для работы аккаунта, генерации сказок, PDF-книг и озвучки готовыми
          голосами рассказчиков.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-card border border-border-light bg-white p-5 shadow-warm-soft">
            <Shield className="mb-4 h-8 w-8 text-accent" />
            <h2 className="font-title text-xl font-bold text-title">Минимум данных</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Сервис использует возрастные группы 3–5, 6–8 и 9–12 лет вместо точного возраста.
            </p>
          </div>
          <div className="rounded-card border border-border-light bg-white p-5 shadow-warm-soft">
            <CheckCircle2 className="mb-4 h-8 w-8 text-accent" />
            <h2 className="font-title text-xl font-bold text-title">Готовые ассеты</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              В основном сценарии используются готовые аватары и готовые голоса рассказчиков.
            </p>
          </div>
          <div className="rounded-card border border-border-light bg-white p-5 shadow-warm-soft">
            <Trash2 className="mb-4 h-8 w-8 text-accent" />
            <h2 className="font-title text-xl font-bold text-title">Удаление данных</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              В аккаунте доступно удаление профиля и связанных материалов: сказок, PDF, MP3 и файлов.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-panel border border-border-light bg-white p-6 shadow-warm-soft md:p-8">
          <div className="space-y-9 text-text">
            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                1. Оператор и пользователь
              </h2>
              <p className="mt-3 leading-relaxed">
                Оператором персональных данных является владелец сервиса «ТвориСказку».
                Сервис находится на стадии хакатон-демо.
              </p>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                2. Какие данные обрабатываются
              </h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-border-light">
                <div className="grid bg-warm-inner/70 text-sm font-bold text-title md:grid-cols-[1.2fr_1fr]">
                  <div className="border-b border-border-light p-4 md:border-b-0 md:border-r">
                    Тип данных
                  </div>
                  <div className="p-4">Цель использования</div>
                </div>
                {processingRows.map((row) => (
                  <div key={row.data} className="grid border-t border-border-light text-sm leading-relaxed md:grid-cols-[1.2fr_1fr]">
                    <div className="p-4 md:border-r md:border-border-light">{row.data}</div>
                    <div className="p-4 text-text-secondary">{row.goal}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                3. Что нельзя вводить на сайте
              </h2>
              <p className="mt-3 leading-relaxed">
                Сервис не предназначен для хранения документов, адресов, телефонов, банковских
                данных, фотографий детей или личных голосовых записей. Перед генерацией и
                озвучкой текст проверяется фильтром персональных данных. Если фильтр находит
                рискованные сведения, запрос не отправляется в сервисы генерации.
              </p>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {forbiddenItems.map((item) => (
                  <li key={item} className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-700">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                4. Способы обработки данных
              </h2>
              <p className="mt-3 leading-relaxed">
                Сервис предназначен для родителей и законных представителей. Дети не должны самостоятельно создавать аккаунт и вводить данные.
                Для персонализации можно использовать имя, псевдоним или сказочное имя ребёнка, а возраст указывать только возрастной группой.
              </p>
              <p className="mt-3 leading-relaxed">
                Пользователь соглашается на обработку данных следующими способами:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {processingActions.map((action) => (
                  <span key={action} className="rounded-full border border-border-light bg-warm-inner/60 px-3 py-1.5 text-sm">
                    {action}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                5. Передача в сервисы генерации
              </h2>
              <p className="mt-3 leading-relaxed">
                Для генерации текста данные передаются в Yandex Cloud AI Studio / DeepSeek
                (российский контур). Для запросов к Yandex Cloud AI Studio отключается
                серверное логирование.
              </p>
              <p className="mt-3 leading-relaxed">
                Для озвучки может использоваться зарубежный технический сервер-ретранслятор
                и сервис ElevenLabs. На зарубежный сервер передаётся очищенный текст
                сказки и технические параметры озвучки: requestId, voiceId, format.
                В таком тексте может оставаться имя или сказочный псевдоним ребёнка,
                если он используется в самой сказке для персонализации. Иные данные,
                кроме имени или сказочного псевдонима в тексте сказки, за границу
                не передаются.
              </p>
              <p className="mt-3 leading-relaxed">
                На зарубежный сервер озвучки НЕ передаются: email, userId,
                storyId, IP пользователя, адрес, телефон, документы, школа/сад, медицинские
                сведения, точная дата рождения, фамилия/отчество ребёнка и исходный пользовательский ввод. Перед
                отправкой текст проверяется: если в нём есть телефон, email, адрес, школа,
                медицинские сведения, фамилия или отчество — озвучка не запускается.
                Зарубежный сервер работает как технический ретранслятор и не хранит тексты,
                аудио или данные пользователей.
              </p>
              <p className="mt-3 leading-relaxed">
                Данные не продаются и не используются для рекламы.
              </p>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                6. Срок хранения и удаление
              </h2>
              <p className="mt-3 leading-relaxed">
                Данные аккаунта и созданные материалы хранятся до удаления аккаунта пользователем
                или до прекращения работы сервиса. При удалении аккаунта удаляются профиль,
                сказки, персонажи, PDF, MP3 и связанные файлы. Технические журналы хранятся
                ограниченный срок и не должны содержать сырой текст пользовательских промптов.
              </p>
            </section>

            <section>
              <h2 className="font-title text-2xl font-bold text-title">
                7. Отзыв согласия и обращения
              </h2>
              <p className="mt-3 leading-relaxed">
                Пользователь может отозвать согласие через удаление аккаунта.
                Для публичного запуска владелец проекта указывает контактный email для
                обращений по вопросам персональных данных. После отзыва согласия обработка
                прекращается, кроме случаев, когда дальнейшее хранение допускается законом.
              </p>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border-light pt-6">
            <button
              onClick={() => navigate('/account')}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-warm-soft transition-all hover:bg-accent-hover"
            >
              Открыть аккаунт
            </button>
            <button
              onClick={() => navigate('/')}
              className="rounded-full border border-border-light bg-white px-5 py-2.5 text-sm font-bold text-text transition-all hover:border-accent hover:text-accent"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
