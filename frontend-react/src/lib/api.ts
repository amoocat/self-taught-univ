/**
 * STU API 클라이언트
 * Vite proxy: /api → http://localhost:8000
 */

const BASE = '/api/v1'

async function request<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail ?? 'API Error'), { status: res.status, data: err })
  }
  return res.json()
}

export const api = {
  // ── 커리큘럼 ─────────────────────────────────────
  getCourses: () => request('/curriculum/'),
  getCourse:  (id: string) => request(`/curriculum/${id}`),
  getLectures:(courseId: string) => request(`/curriculum/${courseId}/lectures`),
  getLecture: (lectureId: string) => request(`/curriculum/lectures/${lectureId}`),
  completeLecture: (courseId: string, lectureId: string) =>
    request(`/curriculum/${courseId}/lectures/${lectureId}/complete`, { method: 'POST' }),

  // ── 노트 ─────────────────────────────────────────
  getNotes:   () => request('/notes/'),
  getNote:    (id: string) => request(`/notes/${id}`),
  createNote: (body: { title: string; content_md: string }) =>
    request('/notes/', { method: 'POST', body: JSON.stringify(body) }),
  updateNote: (id: string, body: Partial<{ title: string; content_md: string }>) =>
    request(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNote: (id: string) => request(`/notes/${id}`, { method: 'DELETE' }),

  // ── 논문 ─────────────────────────────────────────
  getPapers: (q?: string) =>
    request(`/papers/${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  // ── 피드 ─────────────────────────────────────────
  getFeed: (limit = 30) => request(`/feed/?limit=${limit}`),

  // ── 지식 그래프 ──────────────────────────────────
  getGraph: () => request('/graph/'),

  // ── YouTube ──────────────────────────────────────
  getYouTubeStatus:       () => request('/youtube/oauth/status'),
  getPlaylists:           () => request('/youtube/playlists'),
  syncPlaylists:          (ids: string[]) =>
    request('/youtube/playlists/sync-llm', { method: 'POST', body: JSON.stringify(ids) }),
  getRegisteredPlaylists: () => request('/youtube/registered-playlists'),
}
