const API_BASE = "http://localhost:3000/api";
let currentClientId = null;

window.addEventListener("DOMContentLoaded", () => {
  refreshClients();
});

async function refreshClients() {
  try {
    const res = await fetch(`${API_BASE}/clients`);
    const clients = await res.json();
    const select = document.getElementById("client-select");
    select.innerHTML = '<option value="">-- Selecione um cliente --</option>';
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (err) {
    alert("Erro ao carregar clientes: " + err.message);
  }
}

async function createClient() {
  const name = document.getElementById("new-client-name").value.trim();
  if (!name) return alert("Digite o nome do cliente");

  try {
    const res = await fetch(`${API_BASE}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const client = await res.json();
    alert("Cliente criado: " + client.name);
    document.getElementById("new-client-name").value = "";
    refreshClients();
  } catch (err) {
    alert("Erro ao criar cliente: " + err.message);
  }
}

function onClientChange() {
  const clientId = document.getElementById("client-select").value;
  currentClientId = clientId;
  if (clientId) {
    document.getElementById("project-section").style.display = "block";
    loadProjects();
  } else {
    document.getElementById("project-section").style.display = "none";
  }
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/clients/${currentClientId}/projects`);
    const projects = await res.json();
    const select = document.getElementById("project-select");
    select.innerHTML = '<option value="">-- Selecione um projeto --</option>';
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  } catch (err) {
    alert("Erro ao carregar projetos: " + err.message);
  }
}

async function createProject() {
  const name = document.getElementById("project-name").value.trim();
  if (!name) return alert("Digite o nome do projeto");

  try {
    const res = await fetch(`${API_BASE}/clients/${currentClientId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: document.getElementById("project-desc").value || "" }),
    });
    const project = await res.json();
    alert("Projeto criado: " + project.name);
    document.getElementById("project-name").value = "";
    document.getElementById("project-desc").value = "";
    loadProjects();
  } catch (err) {
    alert("Erro ao criar projeto: " + err.message);
  }
}

async function loadPods() {
  try {
    const res = await fetch(`${API_BASE}/clients/${currentClientId}/pods`);
    const pods = await res.json();
    const select = document.getElementById("pod-select");
    select.innerHTML = '<option value="">-- Selecione um POD --</option>';
    pods.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  } catch (err) {
    alert("Erro ao carregar PODs: " + err.message);
  }
}

async function createPod() {
  const projectId = document.getElementById("project-select").value;
  if (!projectId) return alert("Selecione um projeto primeiro");

  const name = document.getElementById("pod-name").value.trim();
  if (!name) return alert("Digite o nome do POD");

  try {
    const res = await fetch(`${API_BASE}/clients/${currentClientId}/pods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, name, description: document.getElementById("pod-desc").value || "" }),
    });
    const pod = await res.json();
    alert("POD criado: " + pod.name);
    document.getElementById("pod-name").value = "";
    document.getElementById("pod-desc").value = "";
    loadPods();
    document.getElementById("upload-section").style.display = "block";
    document.getElementById("value-stream-section").style.display = "block";
  } catch (err) {
    alert("Erro ao criar POD: " + err.message);
  }
}

document.addEventListener("change", (e) => {
  if (e.target.id === "project-select" && e.target.value) {
    document.getElementById("pod-section").style.display = "block";
    loadPods();
  }
});

async function uploadFile() {
  const podId = document.getElementById("pod-select").value;
  if (!podId) return alert("Selecione um POD primeiro");

  const fileInput = document.getElementById("file-input");
  if (!fileInput.files.length) return alert("Selecione um arquivo");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  const statusDiv = document.getElementById("upload-status");
  statusDiv.innerHTML = "Enviando...";

  try {
    const res = await fetch(`${API_BASE}/uploads/${currentClientId}/pods/${podId}/uploads`, {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    if (res.ok) {
      statusDiv.className = "success";
      statusDiv.innerHTML = `✓ Upload realizado com sucesso!<br>Criadas: ${result.processing_result.created}<br>Atualizadas: ${result.processing_result.updated}`;
    } else {
      statusDiv.className = "error";
      statusDiv.innerHTML = `Erro: ${result.error}`;
    }
  } catch (err) {
    statusDiv.className = "error";
    statusDiv.innerHTML = `Erro: ${err.message}`;
  }
}

async function loadValueStreams() {
  try {
    const res = await fetch(`${API_BASE}/value_streams/${currentClientId}`);
    const vss = await res.json();
    const list = document.getElementById("value-streams-list");
    list.innerHTML = "<h3>Value Streams</h3>";

    if (vss.length === 0) {
      list.innerHTML += "<p>Nenhum value stream criado ainda.</p>";
    } else {
      list.innerHTML += "<ul>";
      vss.forEach((vs) => {
        list.innerHTML += `<li><strong>${vs.name}</strong> - ${vs.description || "Sem descrição"}</li>`;
      });
      list.innerHTML += "</ul>";
    }
  } catch (err) {
    alert("Erro ao carregar value streams: " + err.message);
  }
}

async function createValueStream() {
  const name = document.getElementById("vs-name").value.trim();
  if (!name) return alert("Digite o nome do value stream");

  try {
    const res = await fetch(`${API_BASE}/value_streams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: currentClientId, name, description: document.getElementById("vs-desc").value || "", owner: document.getElementById("vs-owner").value || "" }),
    });
    const vs = await res.json();
    alert("Value Stream criado: " + vs.name);
    document.getElementById("vs-name").value = "";
    document.getElementById("vs-desc").value = "";
    document.getElementById("vs-owner").value = "";
    loadValueStreams();
  } catch (err) {
    alert("Erro ao criar value stream: " + err.message);
  }
}

document.addEventListener("click", (e) => {
  if (e.target.textContent === "Criar Value Stream") {
    loadValueStreams();
  }
});
