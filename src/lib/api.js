// In dev: Vite proxies /api → localhost:5000
// In prod: set VITE_API_BASE to your backend URL e.g. https://chatdesk-api.railway.app/api
const BASE = import.meta.env.VITE_API_BASE || '/api'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  req('/login', { method: 'POST', body: JSON.stringify({ email, password }) })

// ── CONVERSATIONS ─────────────────────────────────────────────────────────────
export const getConversations = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return req(`/conversations?${q}`)
}
export const getConversation   = (id) => req(`/conversations/${id}`)
export const resolveConv       = (id) => req(`/conversations/${id}/resolve`, { method: 'POST' })
export const reopenConv        = (id) => req(`/conversations/${id}/reopen`,  { method: 'POST' })
export const assignConv        = (id, agent_id) =>
  req(`/conversations/${id}/assign`, { method: 'POST', body: JSON.stringify({ agent_id }) })

// ── MESSAGES ──────────────────────────────────────────────────────────────────
export const getMessages = (convId) => req(`/conversations/${convId}/messages`)

export const sendMessage = (convId, content, isPrivate = false) =>
  req(`/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, private: isPrivate }),
  })

export const sendAttachment = (convId, file, fileType, caption = '', isPrivate = false) => {
  const fd = new FormData()
  fd.append('file', file, file.name)
  fd.append('type', fileType)
  fd.append('private', String(isPrivate))
  if (caption) fd.append('caption', caption)
  return fetch(`${BASE}/conversations/${convId}/attachments`, { method: 'POST', body: fd })
    .then(r => { if (!r.ok) throw new Error('Upload failed'); return r.json() })
}

// ── LABELS ────────────────────────────────────────────────────────────────────
export const getLabels            = ()             => req('/labels')
export const createLabel          = (name, color)  => req('/labels', { method: 'POST', body: JSON.stringify({ name, color }) })
export const deleteLabel          = (id)           => req(`/labels/${id}`, { method: 'DELETE' })
export const getConvLabels        = (convId)       => req(`/conversations/${convId}/labels`)
export const setConvLabels        = (convId, labels) =>
  req(`/conversations/${convId}/labels`, { method: 'POST', body: JSON.stringify({ labels }) })

// ── CONTACTS ──────────────────────────────────────────────────────────────────
export const getContacts = (page = 1, q = '') => {
  const params = new URLSearchParams({ page })
  if (q) params.set('q', q)
  return req(`/contacts?${params}`)
}
export const getContactConvs = (contactId) => req(`/contacts/${contactId}/conversations`)

// ── AGENTS ────────────────────────────────────────────────────────────────────
export const getAgents    = ()                         => req('/agents')
export const createAgent  = (data)                    => req('/agents', { method: 'POST', body: JSON.stringify(data) })
export const deleteAgent  = (id)                      => req(`/agents/${id}`, { method: 'DELETE' })

// ── KNOWLEDGE BASE ────────────────────────────────────────────────────────────
export const getKnowledge           = (q = '', cat = '') => {
  const params = new URLSearchParams()
  if (q)   params.set('q', q)
  if (cat) params.set('category', cat)
  return req(`/knowledge?${params}`)
}
export const getKnowledgeCategories = ()     => req('/knowledge/categories')
export const createKnowledge        = (data) => req('/knowledge', { method: 'POST', body: JSON.stringify(data) })
export const updateKnowledge        = (id, data) => req(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteKnowledge        = (id)   => req(`/knowledge/${id}`, { method: 'DELETE' })

// ── REPORTS ───────────────────────────────────────────────────────────────────
export const getReports = () => req('/reports/summary')

// ── INBOXES ───────────────────────────────────────────────────────────────────
export const getInboxes = () => req('/inboxes')
