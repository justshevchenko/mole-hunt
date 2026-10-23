// Підписи і відмінювання для інтерфейсу.

export const MODE_LABELS = {
  easy: 'Легкий',
  medium: 'Середній',
  hard: 'Складний',
  epic: 'Епічний',
  auto: 'Авто',
};

export const LEVEL_LABELS = ['Легкий', 'Середній', 'Складний', 'Епічний'];

export const CUP_CAPTIONS = {
  gold: 'Ура! Золото!',
  silver: 'Вітаю зі сріблом!',
  bronze: 'Бронзовий призер!',
};

// «бал» для 1, 21…, «бали» для 2–4, 22–24…, «балів» для решти та 11–14.
export function pointsWord(n) {
  const lastTwo = Math.abs(n) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'балів';
  if (last === 1) return 'бал';
  if (last >= 2 && last <= 4) return 'бали';
  return 'балів';
}
