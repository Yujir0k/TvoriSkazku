export const STORY_COVERS = [
  {
    id: 'enchanted-forest',
    src: '/assets/story-covers/enchanted-forest.webp',
    jpg: '/assets/story-covers/enchanted-forest.jpg',
    keywords: ['лес', 'тропа', 'дерево', 'светлячок', 'огонек', 'огонёк', 'forest', 'wood', 'path', 'firefly'],
  },
  {
    id: 'flower-castle',
    src: '/assets/story-covers/flower-castle.webp',
    jpg: '/assets/story-covers/flower-castle.jpg',
    keywords: ['замок', 'принц', 'принцесс', 'королев', 'castle', 'king', 'queen', 'prince', 'princess'],
  },
  {
    id: 'moon-sea',
    src: '/assets/story-covers/moon-sea.webp',
    jpg: '/assets/story-covers/moon-sea.jpg',
    keywords: ['море', 'океан', 'лодка', 'кораб', 'луна', 'звезд', 'звёзд', 'sea', 'ocean', 'boat', 'moon', 'star'],
  },
  {
    id: 'flower-dragon',
    src: '/assets/story-covers/flower-dragon.webp',
    jpg: '/assets/story-covers/flower-dragon.jpg',
    keywords: ['дракон', 'цвет', 'лотос', 'dragon', 'flower'],
  },
  {
    id: 'woodland-library',
    src: '/assets/story-covers/woodland-library.webp',
    jpg: '/assets/story-covers/woodland-library.jpg',
    keywords: ['библиотек', 'книг', 'чит', 'library', 'book'],
  },
  {
    id: 'snow-village',
    src: '/assets/story-covers/snow-village.webp',
    jpg: '/assets/story-covers/snow-village.jpg',
    keywords: ['снег', 'зима', 'деревн', 'домик', 'мороз', 'snow', 'winter', 'village'],
  },
  {
    id: 'magic-train',
    src: '/assets/story-covers/magic-train.webp',
    jpg: '/assets/story-covers/magic-train.jpg',
    keywords: ['поезд', 'станц', 'рельс', 'вагон', 'train', 'station'],
  },
  {
    id: 'underwater-library',
    src: '/assets/story-covers/underwater-library.webp',
    jpg: '/assets/story-covers/underwater-library.jpg',
    keywords: ['подвод', 'озеро', 'ракуш', 'водорос', 'underwater', 'lake', 'shell'],
  },
  {
    id: 'fairy-meadow',
    src: '/assets/story-covers/fairy-meadow.webp',
    jpg: '/assets/story-covers/fairy-meadow.jpg',
    keywords: ['фея', 'фееч', 'гриб', 'луг', 'волшебниц', 'fairy', 'meadow', 'mushroom'],
  },
  {
    id: 'crystal-cave',
    src: '/assets/story-covers/crystal-cave.webp',
    jpg: '/assets/story-covers/crystal-cave.jpg',
    keywords: ['пещер', 'кристалл', 'гора', 'камн', 'cave', 'crystal', 'mountain'],
  },
  {
    id: 'cloud-city',
    src: '/assets/story-covers/cloud-city.webp',
    jpg: '/assets/story-covers/cloud-city.jpg',
    keywords: ['облак', 'радуг', 'небо', 'город', 'cloud', 'rainbow', 'sky'],
  },
  {
    id: 'fox-explorer',
    src: '/assets/story-covers/fox-explorer.webp',
    jpg: '/assets/story-covers/fox-explorer.jpg',
    keywords: ['лиса', 'лис', 'карта', 'фонар', 'путеше', 'fox', 'map', 'lantern', 'travel'],
  },
];

function hashValue(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function getStoryCover(story) {
  const text = `${story?.title || ''}\n${story?.content || ''}`.toLowerCase();
  const cover = STORY_COVERS.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  if (cover) return cover;

  const seed = story?.id || story?.title || text || 'story';
  return STORY_COVERS[hashValue(seed) % STORY_COVERS.length];
}
