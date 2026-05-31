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

// SSE 스트리밍 헬퍼 — onChunk(text) 콜백으로 토큰 전달
export async function streamSSE(
  path: string,
  body: object,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('Stream failed')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return
      try { onChunk(JSON.parse(payload).text ?? '') } catch { /* skip */ }
    }
  }
}

export const api = {
  // ── 커리큘럼 ─────────────────────────────────────
  getHeatmap: () => request('/curriculum/heatmap'),
  getStudyStats: () => request('/curriculum/stats'),
  getCourses: (params?: { q?: string; category?: string; limit?: number; offset?: number }) =>
    request(`/curriculum/${params ? `?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v])=>[k,String(v)])).toString()}` : ''}`),
  getCourse:  (id: string) => request(`/curriculum/${id}`),
  getLectures:(courseId: string, params?: { q?: string; limit?: number; offset?: number }) =>
    request(`/curriculum/${courseId}/lectures${params ? `?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v])=>[k,String(v)])).toString()}` : ''}`),

  // ── 통합 검색 ─────────────────────────────────────
  search: (q: string, type?: string) =>
    request(`/search/?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`),
  getLecture: (lectureId: string) => request(`/curriculum/lectures/${lectureId}`),
  completeLecture: (courseId: string, lectureId: string) =>
    request(`/curriculum/${courseId}/lectures/${lectureId}/complete`, { method: 'POST' }),

  // ── 노트 ─────────────────────────────────────────
  getNotes:   (params?: { q?: string; limit?: number; offset?: number }) =>
    request(`/notes/${params ? `?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}` : ''}`),
  getNote:    (id: string) => request(`/notes/${id}`),
  createNote: (body: { title: string; content_md: string }) =>
    request('/notes/', { method: 'POST', body: JSON.stringify(body) }),
  updateNote: (id: string, body: Partial<{ title: string; content_md: string }>) =>
    request(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNote: (id: string) => request(`/notes/${id}`, { method: 'DELETE' }),

  // ── 논문 ─────────────────────────────────────────
  getPapers: (q?: string) =>
    request(`/papers/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPaper:  (id: string) => request(`/papers/${id}`),

  // ── 피드 ─────────────────────────────────────────
  getFeed: (limit = 30) => request(`/feed/?limit=${limit}`),

  // ── 논문 주석 ────────────────────────────────────
  addPaper:       (arxiv_id: string) => request('/papers/', { method: 'POST', body: JSON.stringify({ arxiv_id }) }),
  annotatePaper:  (id: string) => request(`/papers/${id}/annotate`, { method: 'POST' }),

  // ── 지식 그래프 ──────────────────────────────────
  getGraph:              () => request('/graph/'),
  generateGraph:         () => request('/graph/generate', { method: 'POST' }),
  addGraphFromLecture:   (lectureId: string) => request(`/graph/from-lecture/${lectureId}`, { method: 'POST' }),

  // ── YouTube ──────────────────────────────────────
  getYouTubeStatus:       () => request('/youtube/oauth/status'),
  getPlaylists:           () => request('/youtube/playlists'),
  syncPlaylists:          (ids: string[]) =>
    request('/youtube/playlists/sync-llm', { method: 'POST', body: JSON.stringify(ids) }),
  getRegisteredPlaylists: () => request('/youtube/registered-playlists'),
}
