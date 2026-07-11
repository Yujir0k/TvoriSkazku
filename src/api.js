const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const isJsonBody = options.body !== undefined && options.body !== null;
  const headers = {
    ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...fetchOptions.headers,
  };

  const controller = typeof AbortController !== 'undefined' && !fetchOptions.signal
    ? new AbortController()
    : null;
  const timeoutId = controller && timeoutMs > 0
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
      ...fetchOptions,
      signal: fetchOptions.signal || controller?.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Сервер отвечает слишком долго');
    }
    throw new Error('Не удалось подключиться к серверу. Проверьте, что сервис запущен, и попробуйте ещё раз.');
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }

  if (res.status === 204) return null;

  if (!res.ok) {
    // Централизованная обработка 401 — сбрасываем auth-состояние на фронте
    if (res.status === 401 && !path.startsWith('/auth/me')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    const data = await res.json();
    const err = new Error(data.message || 'Ошибка запроса');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const data = await res.json();
  return data;
}

export function signUp({ name, email, password, privacyConsentAccepted }) {
  return request('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, privacyConsentAccepted }),
  });
}

export function signIn({ email, password }) {
  return request('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signOut() {
  return request('/auth/sign-out', { method: 'POST' });
}

export function signOutAll() {
  return request('/auth/sign-out-all', { method: 'POST' });
}

export function getMe() {
  return request('/auth/me');
}

export function verifyEmail(token) {
  return request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resendVerification() {
  return request('/auth/resend-verification', { method: 'POST' });
}

export function forgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword({ token, password }) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export function updateAccount(data) {
  return request('/auth/account', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAccount() {
  return request('/auth/account', { method: 'DELETE' });
}

export function getSessions() {
  return request('/auth/sessions');
}

export function deleteSession(id) {
  return request(`/auth/sessions/${id}`, { method: 'DELETE' });
}

export function generateStory(payload) {
  return request('/stories/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getStoryJob(jobId) {
  return request(`/stories/jobs/${encodeURIComponent(jobId)}`);
}

export function cancelStoryJob(jobId) {
  return request(`/stories/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

// --- Story CRUD ---

export function createStory(data) {
  return request('/stories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getStories(query = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.limit) params.set('limit', query.limit);
  if (query.offset) params.set('offset', query.offset);
  const qs = params.toString();
  return request(`/stories${qs ? '?' + qs : ''}`);
}

export function getStory(id) {
  return request(`/stories/${encodeURIComponent(id)}`);
}

export function updateStory(id, data) {
  return request(`/stories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteStory(id) {
  return request(`/stories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Child Profiles ---

export function createProfile(data) {
  return request('/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getProfiles() {
  return request('/profiles');
}

export function getProfile(id) {
  return request(`/profiles/${encodeURIComponent(id)}`);
}

export function updateProfile(id, data) {
  return request(`/profiles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteProfile(id) {
  return request(`/profiles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Characters ---

export function createCharacter(data) {
  return request('/characters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getCharacters(query = {}) {
  const params = new URLSearchParams();
  if (query.childProfileId) params.set('childProfileId', query.childProfileId);
  const qs = params.toString();
  return request(`/characters${qs ? '?' + qs : ''}`);
}

export function getCharacter(id) {
  return request(`/characters/${encodeURIComponent(id)}`);
}

export function updateCharacter(id, data) {
  return request(`/characters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCharacter(id) {
  return request(`/characters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Tariffs ---

export function getTariffs() {
  return request('/tariffs', { timeoutMs: 1200 });
}

export function getMyTariff() {
  return request('/tariffs/me');
}

// --- Scenes ---

export function getScenes(storyId) {
  return request(`/scenes?storyId=${encodeURIComponent(storyId)}`);
}

export function getScene(id) {
  return request(`/scenes/${encodeURIComponent(id)}`);
}

export function createScene(data) {
  return request('/scenes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateScene(id, data) {
  return request(`/scenes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteScene(id) {
  return request(`/scenes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function reorderScenes(storyId, sceneIds) {
  return request(`/scenes/reorder?storyId=${encodeURIComponent(storyId)}`, {
    method: 'POST',
    body: JSON.stringify({ sceneIds }),
  });
}

// --- Illustrations ---

export function getIllustrations(storyId) {
  return request(`/illustrations?storyId=${encodeURIComponent(storyId)}`);
}

export function getIllustrationProviderStatus() {
  return request('/illustrations/provider-status');
}

export function generateIllustration(data) {
  return request('/illustrations/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getGeneratedIllustrationStatus(id) {
  return request(`/illustrations/${encodeURIComponent(id)}/status`);
}

export function getIllustration(id) {
  return request(`/illustrations/${encodeURIComponent(id)}`);
}

export async function uploadIllustration(storyId, file, sceneId, style) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('storyId', storyId);
  if (sceneId) formData.append('sceneId', sceneId);
  if (style) formData.append('style', style);
  const res = await fetch(`${API_BASE}/illustrations/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Ошибка загрузки');
  }
  return res.json();
}

export async function replaceIllustration(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/illustrations/${encodeURIComponent(id)}/replace`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Ошибка замены');
  }
  return res.json();
}

export function deleteIllustration(id) {
  return request(`/illustrations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getIllustrationUrl(id) {
  return request(`/illustrations/${encodeURIComponent(id)}/url`);
}

// --- Books / PDF ---

export function getBooks() {
  return request('/books');
}

export function getBook(id) {
  return request(`/books/${encodeURIComponent(id)}`);
}

export function createBook(data) {
  return request('/books', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateBook(id, data) {
  return request(`/books/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function generateBookPdf(id) {
  return request(`/books/${encodeURIComponent(id)}/generate`, { method: 'POST' });
}

export function getBookPdfUrl(id) {
  return request(`/books/${encodeURIComponent(id)}/pdf-url`);
}

export async function downloadBookPdf(id) {
  const res = await fetch(`${API_BASE}/books/${encodeURIComponent(id)}/download`, {
    credentials: 'include',
  });
  if (!res.ok) {
    let message = 'Не удалось скачать PDF';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      // Keep the readable fallback for non-JSON gateway errors.
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error('Получен пустой PDF-файл');
  const contentType = res.headers?.get?.('content-type') || blob.type || '';
  if (contentType && !contentType.toLowerCase().includes('application/pdf')) {
    throw new Error('Сервис вернул файл неверного формата');
  }
  return blob;
}

export function getBookPdfDownloadUrl(id) {
  return `${API_BASE}/books/${encodeURIComponent(id)}/download`;
}

export function deleteBook(id) {
  return request(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── TTS (ElevenLabs) ────────────────────────────────────────────────────────

export async function getTtsVoices() {
  const voices = await request('/tts/voices');
  return voices.map((voice) => ({
    ...voice,
    previewUrl: voice.previewUrl || `${API_BASE}/tts/voices/${encodeURIComponent(voice.voiceId)}/preview`,
  }));
}

export function getTtsStatus() {
  return request('/tts/status');
}

export function generateStoryAudio(storyId, { voiceId, mode, expressive, characterVoices }) {
  return request(`/tts/stories/${encodeURIComponent(storyId)}/audio`, {
    method: 'POST',
    body: JSON.stringify({ voiceId, mode, expressive, characterVoices }),
  });
}

export function getStoryAudioList(storyId) {
  return request(`/tts/stories/${encodeURIComponent(storyId)}/audio`);
}

export function getStoryAudioStatus(audioId) {
  return request(`/tts/story-audio/${encodeURIComponent(audioId)}/status`);
}

export function getStoryAudioUrl(audioId) {
  return request(`/tts/story-audio/${encodeURIComponent(audioId)}/url`);
}

export async function downloadStoryAudio(audioId) {
  const res = await fetch(`${API_BASE}/tts/story-audio/${encodeURIComponent(audioId)}/download`, {
    credentials: 'include',
  });

  if (!res.ok) {
    let message = 'Не удалось скачать MP3';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      // The endpoint normally returns JSON errors, but keep a useful fallback.
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error('Получен пустой MP3-файл');
  const contentType = res.headers?.get?.('content-type') || blob.type || '';
  if (contentType && !contentType.toLowerCase().includes('audio/')) {
    throw new Error('Сервис вернул файл неверного формата');
  }
  return blob;
}

export function getStoryAudioDownloadUrl(audioId) {
  return `${API_BASE}/tts/story-audio/${encodeURIComponent(audioId)}/download`;
}

export function deleteStoryAudio(audioId) {
  return request(`/tts/story-audio/${encodeURIComponent(audioId)}`, { method: 'DELETE' });
}

export function cancelStoryAudio(audioId) {
  return request(`/tts/story-audio/${encodeURIComponent(audioId)}/cancel`, { method: 'POST' });
}
