import React, { useEffect, useState } from 'react'
import * as api from './api'

function ClientForm({ onCreated }){
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  async function submit(){
    if(!name) return
    await api.createClient({ name, description: desc })
    setName(''); setDesc('')
    onCreated()
  }
  return (
    <div>
      <input placeholder="Nome do cliente" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="Descrição" value={desc} onChange={e=>setDesc(e.target.value)} />
      <button onClick={submit}>Criar Cliente</button>
    </div>
  )
}

function ProjectForm({ clientId, onCreated }){
  const [name, setName] = useState('')
  async function submit(){
    if(!clientId || !name) return
    await api.createProject(clientId, { name })
    setName('')
    onCreated()
  }
  return (
    <div>
      <input placeholder="Nome do projeto" value={name} onChange={e=>setName(e.target.value)} />
      <button onClick={submit}>Criar Projeto</button>
    </div>
  )
}

function PodForm({ clientId, projects, onCreated }){
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (projects?.length && !projectId) {
      setProjectId(projects[0]?.id || '')
    }
  }, [projects])

  async function submit(){
    if(!clientId || !name || !projectId) return
    await api.createPod(clientId, { name, project_id: projectId })
    setName('')
    onCreated()
  }
  return (
    <div>
      <select value={projectId} onChange={e=>setProjectId(e.target.value)}>
        <option value="">-- selecione projeto --</option>
        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input placeholder="Nome do pod" value={name} onChange={e=>setName(e.target.value)} />
      <button onClick={submit}>Criar POD</button>
    </div>
  )
}

function ValueStreamForm({ clientId, onCreated }){
  const [name, setName] = useState('')
  async function submit(){
    if(!clientId || !name) return
    await api.createValueStream(clientId, { name })
    setName('')
    onCreated()
  }
  return (
    <div>
      <input placeholder="Nome do value stream" value={name} onChange={e=>setName(e.target.value)} />
      <button onClick={submit}>Criar Value Stream</button>
    </div>
  )
}

function EditableItem({ item, onUpdate, onDelete }){
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.name || '')
  useEffect(()=> setValue(item.name || ''), [item])
  async function save(){
    await onUpdate(item.id, { name: value })
    setEditing(false)
  }
  return (
    <div className="item-row">
      {editing ? (
        <>
          <input value={value} onChange={e=>setValue(e.target.value)} />
          <button onClick={save}>Salvar</button>
          <button onClick={()=>{ setEditing(false); setValue(item.name || '') }}>Cancelar</button>
        </>
      ) : (
        <>
          <span style={{flex:1}}>{item.name}</span>
          <button onClick={()=>setEditing(true)}>Editar</button>
          <button onClick={()=>onDelete(item.id)}>Remover</button>
        </>
      )}
    </div>
  )
}

export default function App(){
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [projects, setProjects] = useState([])
  const [pods, setPods] = useState([])
  const [valueStreams, setValueStreams] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedPod, setSelectedPod] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(()=>{ reloadClients() }, [])

  async function reloadClients(){
    const c = await api.listClients()
    setClients(c || [])
  }

  async function onClientChange(e){
    const id = e.target.value
    setClientId(id)
    setSelectedProject('')
    setSelectedPod('')
    if(!id){ setProjects([]); setPods([]); setValueStreams([]); return }
    const [projs, pds, vs] = await Promise.all([
      api.listProjects(id), api.listPods(id), api.listValueStreams(id)
    ])
    setProjects(projs || [])
    setPods(pds || [])
    setValueStreams(vs || [])
  }

  async function handleUpload(){
    if(!file || !clientId || !selectedPod) return setStatus('Preencha cliente, pod e selecione arquivo')
    setStatus('Enviando...')
    try{
      await api.uploadFileFor({ clientId, podId: selectedPod, file })
      setStatus('Upload concluído')
    }catch(e){
      setStatus('Erro no upload')
    }
  }

  async function removeClient(id){ if(!confirm('Remover cliente?')) return; await api.deleteClient(id); reloadClients() }
  async function removeProject(id){ if(!confirm('Remover projeto?')) return; await api.deleteProject(clientId, id); onClientChange({ target:{ value: clientId } }) }
  async function removePod(id){ if(!confirm('Remover pod?')) return; await api.deletePod(clientId, id); onClientChange({ target:{ value: clientId } }) }

  return (
    <div className="container">
      <header>
        <h1>Painel Gestão de Projetos</h1>
        <p>Importação de Épicos e Value Streams Jira</p>
      </header>

      <section className="card glass">
        <h2>1. Clientes</h2>
        <div style={{display:'flex', gap:8}}>
          <select value={clientId} onChange={onClientChange}>
            <option value="">-- selecione cliente --</option>
            {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={reloadClients}>Atualizar</button>
        </div>
        <ClientForm onCreated={reloadClients} />
        <div>
          {clients.map(c=> (
            <EditableItem key={c.id} item={c} onUpdate={async (id, body)=>{ await api.updateClient(id, body); reloadClients() }} onDelete={removeClient} />
          ))}
        </div>
      </section>

      <section className="card glass">
        <h2>2. Projetos</h2>
        <ProjectForm clientId={clientId} onCreated={()=>onClientChange({ target:{ value: clientId } })} />
        <div>
          {projects.map(p=> (
            <EditableItem key={p.id} item={p} onUpdate={async (id, body)=>{ await api.updateProject(clientId, id, body); onClientChange({ target:{ value: clientId } }) }} onDelete={removeProject} />
          ))}
        </div>
      </section>

      <section className="card glass">
        <h2>3. PODs</h2>
        <PodForm clientId={clientId} projects={projects} onCreated={()=>onClientChange({ target:{ value: clientId } })} />
        <div>
          {pods.map(p=> (
            <EditableItem key={p.id} item={p} onUpdate={async (id, body)=>{ await api.updatePod(clientId, id, { ...body, project_id: p.project_id || projects[0]?.id }); onClientChange({ target:{ value: clientId } }) }} onDelete={removePod} />
          ))}
        </div>
      </section>

      <section className="card glass">
        <h2>4. Value Streams</h2>
        <ValueStreamForm clientId={clientId} onCreated={()=>onClientChange({ target:{ value: clientId } })} />
        <div>
          {valueStreams.map(v=> (
            <EditableItem key={v.id} item={v} onUpdate={async (id, body)=>{ await api.updateValueStream(clientId, id, body); onClientChange({ target:{ value: clientId } }) }} onDelete={async (id)=>{ if(!confirm('Remover value stream?')) return; await api.deleteValueStream(clientId, id); onClientChange({ target:{ value: clientId } }) }} />
          ))}
        </div>
      </section>

      <section className="card glass">
        <h2>5. Upload</h2>
        <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} accept=".csv,.xlsx,.xls" />
        <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}>
          <option value="">-- projeto (opcional) --</option>
          {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selectedPod} onChange={e=>setSelectedPod(e.target.value)}>
          <option value="">-- selecione pod --</option>
          {pods.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={handleUpload}>Enviar</button>
        <div>{status}</div>
      </section>

    </div>
  )
}
