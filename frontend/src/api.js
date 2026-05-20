const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'

async function request(path, opts = {}){
  const url = `${API_BASE}${path}`
  const res = await fetch(url, opts)
  if(res.status === 204) return null
  const text = await res.text()
  try{ return text ? JSON.parse(text) : null } catch { return text }
}

export const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) }
  const body = opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
  return request(path, { ...opts, headers, body })
}

export const postForm = async (path, formData) => {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, { method: 'POST', body: formData })
  if(!res.ok) throw new Error('upload failed')
  return res.json()
}

// CRUD helpers
export const listClients = () => api('/clients')
export const createClient = (data) => api('/clients', { method: 'POST', body: data })
export const updateClient = (id, data) => api(`/clients/${id}`, { method: 'PUT', body: data })
export const deleteClient = (id) => api(`/clients/${id}`, { method: 'DELETE' })

export const listProjects = (clientId) => api(`/clients/${clientId}/projects`)
export const createProject = (clientId, data) => api(`/clients/${clientId}/projects`, { method: 'POST', body: data })
export const updateProject = (clientId, id, data) => api(`/clients/${clientId}/projects/${id}`, { method: 'PUT', body: data })
export const deleteProject = (clientId, id) => api(`/clients/${clientId}/projects/${id}`, { method: 'DELETE' })

export const listPods = (clientId) => api(`/clients/${clientId}/pods`)
export const createPod = (clientId, data) => api(`/clients/${clientId}/pods`, { method: 'POST', body: data })
export const updatePod = (clientId, id, data) => api(`/clients/${clientId}/pods/${id}`, { method: 'PUT', body: data })
export const deletePod = (clientId, id) => api(`/clients/${clientId}/pods/${id}`, { method: 'DELETE' })

export const listValueStreams = (clientId) => api(`/clients/${clientId}/value_streams`)
export const createValueStream = (clientId, data) => api(`/clients/${clientId}/value_streams`, { method: 'POST', body: data })
export const updateValueStream = (clientId, id, data) => api(`/clients/${clientId}/value_streams/${id}`, { method: 'PUT', body: data })
export const deleteValueStream = (clientId, id) => api(`/clients/${clientId}/value_streams/${id}`, { method: 'DELETE' })

export const uploadFileFor = ({ clientId, podId, file }) => {
  const url = `/clients/${clientId}/pods/${podId}/uploads`
  const fd = new FormData()
  fd.append('file', file)
  return postForm(url, fd)
}

export default { api, listClients, createClient, updateClient, deleteClient }
