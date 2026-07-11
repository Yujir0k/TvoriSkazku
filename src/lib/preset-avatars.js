export const NO_AVATAR_ID = 'none';

export const PRESET_AVATARS = [
  { id: 'bear-heart', name: 'Мишка с сердцем', image: '/assets/preset-avatars/bear-heart.webp', type: 'animal' },
  { id: 'fox-lantern', name: 'Лисёнок с фонариком', image: '/assets/preset-avatars/fox-lantern.webp', type: 'animal' },
  { id: 'hedgehog-shell', name: 'Ёжик с ракушкой', image: '/assets/preset-avatars/hedgehog-shell.webp', type: 'animal' },
  { id: 'owl-books', name: 'Сова на книгах', image: '/assets/preset-avatars/owl-books.webp', type: 'animal' },
  { id: 'bunny-wizard', name: 'Зайчик-волшебник', image: '/assets/preset-avatars/bunny-wizard.webp', type: 'fairytale' },
  { id: 'squirrel-acorn', name: 'Белочка с желудем', image: '/assets/preset-avatars/squirrel-acorn.webp', type: 'animal' },
  { id: 'raccoon-clock', name: 'Енот-хранитель времени', image: '/assets/preset-avatars/raccoon-clock.webp', type: 'fairytale' },
  { id: 'mouse-umbrella', name: 'Мышка с зонтиком', image: '/assets/preset-avatars/mouse-umbrella.webp', type: 'fairytale' },
  { id: 'kitten-wizard', name: 'Котёнок-маг', image: '/assets/preset-avatars/kitten-wizard.webp', type: 'fairytale' },
  { id: 'dragon-flower', name: 'Дракончик с цветком', image: '/assets/preset-avatars/dragon-flower.webp', type: 'fairytale' },
  { id: 'unicorn-foal', name: 'Единорожек', image: '/assets/preset-avatars/unicorn-foal.webp', type: 'fairytale' },
  { id: 'raccoon-explorer', name: 'Енот-путешественник', image: '/assets/preset-avatars/raccoon-explorer.webp', type: 'animal' },
  { id: 'mouse-princess', name: 'Мышка-принцесса', image: '/assets/preset-avatars/mouse-princess.webp', type: 'fairytale' },
  { id: 'badger-librarian', name: 'Барсук-библиотекарь', image: '/assets/preset-avatars/badger-librarian.webp', type: 'animal' },
  { id: 'frog-prince', name: 'Лягушонок-принц', image: '/assets/preset-avatars/frog-prince.webp', type: 'fairytale' },
  { id: 'deer-star', name: 'Оленёнок со звёздным шарфом', image: '/assets/preset-avatars/deer-star.webp', type: 'animal' },
  { id: 'turtle-map', name: 'Черепаха-картограф', image: '/assets/preset-avatars/turtle-map.webp', type: 'animal' },
  { id: 'otter-flute', name: 'Выдра-музыкант', image: '/assets/preset-avatars/otter-flute.webp', type: 'animal' },
];

export const DEFAULT_PROFILE_AVATAR_ID = 'bunny-wizard';
export const DEFAULT_CHARACTER_AVATAR_ID = 'fox-lantern';

export function getPresetAvatar(id, fallbackId = DEFAULT_CHARACTER_AVATAR_ID) {
  if (!id || id === NO_AVATAR_ID) return null;
  return PRESET_AVATARS.find((avatar) => avatar.id === id)
    || PRESET_AVATARS.find((avatar) => avatar.id === fallbackId)
    || PRESET_AVATARS[0];
}
