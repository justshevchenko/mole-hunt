// Анонімний ідентифікатор гравця. Живе в localStorage; якщо сховище
// недоступне (приватний режим), — лише в пам'яті до закриття вкладки.
const STORAGE_KEY = 'molehunt.playerId';

export function getPlayerId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return (getPlayerId.memory ??= crypto.randomUUID());
  }
}
