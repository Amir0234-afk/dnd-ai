const key = (sessionId: string) => `dnd_memory_${sessionId}`;

export function loadLocalMemory(sessionId: string): string | null {
  return localStorage.getItem(key(sessionId));
}

export function saveLocalMemory(sessionId: string, content: string): void {
  localStorage.setItem(key(sessionId), content);
}
