// setup.js
const fs = require('fs');
const path = require('path');

const files = {
  'package.json': `{
  "name": "painelgestaoprojeto-backend",
  "version": "1.0.0",
  "description": "Backend para importação e gestão de value streams com Jira issues",
  "main": "backend/server.js",
  "scripts": {
    "start": "node backend/server.js",
    "dev": "nodemon backend/server.js",
    "seed": "node scripts/seed_test_data.js",
    "ingest": "node scripts/ingest_csv.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "papaparse": "^5.4.1",
    "xlsx": "^0.18.5",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}`,

  '.env.example': `SUPABASE_URL=https://kllxfhtuihrcbglsowda.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbHhmaHR1aWhyY2JnbHNvd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNDc0ODMsImV4cCI6MjA5NDgyMzQ4M30.JyBv6L_me4P0FxapkjOVKv_FgL-BxKFqlajNQrBmqhw
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbHhmaHR1aWhyY2JnbHNvd2RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0NzQ4MywiZXhwIjoyMDk0ODIzNDgzfQ.WUlRkFFnHtJpXAoXr2SwRFNWEkvaa1wJrTVRNWqm9fc
PORT=3000
NODE_ENV=development`,

  'backend/lib/supabase.js': `const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
}
const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;`,

  'backend/lib/ingest.js': `const supabase = require("./supabase");
async function normalizeIssues(rows, clientId, podId, uploadId) {
  return rows.map((row, idx) => ({
    client_id: clientId,
    pod_id: podId,
    upload_id: uploadId,
    issue_key: row.issue_key || row.key || "",
    issue_type: row.issue_type || row.type || "Task",
    summary: row.summary || row.title || "",
    status: row.status || "To Do",
    assignee: row.assignee || null,
    priority: row.priority || null,
    epic_link: row.epic_link || null,
    parent_issue_key: row.parent_issue_key || null,
    original_estimate: row.original_estimate || null,
    story_points: row.story_points ? parseFloat(row.story_points) : null,
    due_date: row.due_date || null,
    metadata: { source_row: idx },
  }));
}
async function upsertIssues(issues) {
  const errors = [];
  const created = [];
  const updated = [];
  for (const issue of issues) {
    try {
      const { data, error } = await supabase
        .from("issues")
        .upsert(issue, { onConflict: "client_id,issue_key" })
        .select();
      if (error) throw error;
      if (data && data.length > 0) {
        const createdAt = new Date(data[0].created_at);
        if (Date.now() - createdAt < 1000) {
          created.push(data[0]);
        } else {
          updated.push(data[0]);
        }
      }
    } catch (err) {
      errors.push({ issue: issue.issue_key, error: err.message });
    }
  }
  return { created, updated, errors };
}
async function reconcileParentChild(clientId) {
  try {
    const { data: issues, error } = await supabase
      .from("issues")
      .select("id, issue_key, parent_issue_key")
      .eq("client_id", clientId)
      .not("parent_issue_key", "is", null);
    if (error) throw error;
    for (const child of issues) {
      const { data: parentIssue } = await supabase
        .from("issues")
        .select("id")
        .eq("client_id", clientId)
        .eq("issue_key", child.parent_issue_key)
        .single();
      if (parentIssue) {
        await supabase
          .from("issues")
          .update({ parent_id: parentIssue.id })
          .eq("id", child.id);
      }
    }
  } catch (err) {
    console.error("Error reconciling parent/child:", err);
  }
}
async function processUpload(uploadId, rows, clientId, podId) {
  try {
    const normalized = await normalizeIssues(rows, clientId, podId, uploadId);
    const result = await upsertIssues(normalized);
    await reconcileParentChild(clientId);
    await supabase
      .from("uploads")
      .update({
        status: "processed",
        row_count: rows.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", uploadId);
    return { success: true, created: result.created.length, updated: result.updated.length, errors: result.errors };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
module.exports = { normalizeIssues, upsertIssues, reconcileParentChild, processUpload };`,

  'backend/routes/clients.js': `const express = require("express");
const supabase = require("../lib/supabase");
const router = express.Router();
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("clients").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/", async (req, res) => {
  try {
    const { name, metadata } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase
      .from("clients")
      .insert([{ name, metadata: metadata || {} }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:client_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", req.params.client_id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Client not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/routes/projects.js': `const express = require("express");
const supabase = require("../lib/supabase");
const router = express.Router();
router.post("/:client_id/projects", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase
      .from("projects")
      .insert([{ client_id: req.params.client_id, name, description }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:client_id/projects", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("client_id", req.params.client_id);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/routes/pods.js': `const express = require("express");
const supabase = require("../lib/supabase");
const router = express.Router();
router.post("/:client_id/pods", async (req, res) => {
  try {
    const { project_id, name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    if (!project_id) return res.status(400).json({ error: "project_id is required" });
    const { data, error } = await supabase
      .from("pods")
      .insert([{ client_id: req.params.client_id, project_id, name, description }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:client_id/pods", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pods")
      .select("*")
      .eq("client_id", req.params.client_id);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/routes/uploads.js': `const express = require("express");
const multer = require("multer");
const Papa = require("papaparse");
const XLSX = require("xlsx");
const supabase = require("../lib/supabase");
const { processUpload } = require("../lib/ingest");
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();
router.post("/:client_id/pods/:pod_id/uploads", upload.single("file"), async (req, res) => {
  try {
    const { client_id, pod_id } = req.params;
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const sourceType = req.file.mimetype.includes("spreadsheet") || req.file.originalname.endsWith(".xlsx") ? "excel" : "csv";
    const { data: uploadRecord, error: uploadErr } = await supabase
      .from("uploads")
      .insert([{ client_id, pod_id, source_type: sourceType, source_ref: req.file.originalname, status: "pending" }])
      .select();
    if (uploadErr) throw uploadErr;
    const uploadId = uploadRecord[0].id;
    let rows = [];
    if (sourceType === "excel") {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      rows = await new Promise((resolve, reject) => {
        Papa.parse(req.file.buffer.toString("utf8"), {
          complete: (result) => resolve(result.data),
          header: true,
          error: (err) => reject(err),
        });
      });
    }
    const result = await processUpload(uploadId, rows, client_id, pod_id);
    res.json({ upload_id: uploadId, processing_result: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:upload_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("id", req.params.upload_id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Upload not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/routes/value_streams.js': `const express = require("express");
const supabase = require("../lib/supabase");
const router = express.Router();
router.post("/", async (req, res) => {
  try {
    const { client_id, name, description, owner } = req.body;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    if (!name) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase
      .from("value_streams")
      .insert([{ client_id, name, description, owner }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:client_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("value_streams")
      .select("*")
      .eq("client_id", req.params.client_id);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/routes/issues.js': `const express = require("express");
const supabase = require("../lib/supabase");
const router = express.Router();
router.post("/:issue_id/link-value-stream", async (req, res) => {
  try {
    const { value_stream_id, client_id } = req.body;
    if (!value_stream_id) return res.status(400).json({ error: "value_stream_id is required" });
    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    const { data, error } = await supabase
      .from("issue_value_streams")
      .insert([{ issue_id: req.params.issue_id, value_stream_id, client_id }])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:issue_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("issues")
      .select("*, issue_value_streams(*)")
      .eq("id", req.params.issue_id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Issue not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;`,

  'backend/server.js': `require("dotenv").config();
const express = require("express");
const cors = require("cors");
const clientsRoutes = require("./routes/clients");
const projectsRoutes = require("./routes/projects");
const podsRoutes = require("./routes/pods");
const uploadsRoutes = require("./routes/uploads");
const valueStreamsRoutes = require("./routes/value_streams");
const issuesRoutes = require("./routes/issues");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));
app.use("/api/clients", clientsRoutes);
app.use("/api/clients", projectsRoutes);
app.use("/api/clients", podsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/value_streams", valueStreamsRoutes);
app.use("/api/issues", issuesRoutes);
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,

  'frontend/index.html': `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel Gestão de Projetos</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Painel Gestão de Projetos</h1>
            <p>Importação de Épicos e Value Streams Jira</p>
        </header>
        <section id="client-section">
            <h2>1. Selecione ou Crie um Cliente</h2>
            <select id="client-select" onchange="onClientChange()">
                <option value="">-- Carregando clientes --</option>
            </select>
            <button onclick="refreshClients()">Atualizar</button>
            <br><br>
            <input type="text" id="new-client-name" placeholder="Nome do novo cliente">
            <button onclick="createClient()">Criar Cliente</button>
        </section>
        <section id="project-section" style="display:none;">
            <h2>2. Crie um Projeto</h2>
            <input type="text" id="project-name" placeholder="Nome do projeto">
            <input type="text" id="project-desc" placeholder="Descrição (opcional)">
            <button onclick="createProject()">Criar Projeto</button>
            <select id="project-select">
                <option value="">-- Projetos --</option>
            </select>
        </section>
        <section id="pod-section" style="display:none;">
            <h2>3. Crie um POD</h2>
            <input type="text" id="pod-name" placeholder="Nome do POD">
            <input type="text" id="pod-desc" placeholder="Descrição (opcional)">
            <button onclick="createPod()">Criar POD</button>
            <select id="pod-select">
                <option value="">-- PODs --</option>
            </select>
        </section>
        <section id="upload-section" style="display:none;">
            <h2>4. Faça Upload de Arquivo (CSV/Excel)</h2>
            <input type="file" id="file-input" accept=".csv,.xlsx,.xls">
            <button onclick="uploadFile()">Enviar Arquivo</button>
            <div id="upload-status"></div>
        </section>
        <section id="value-stream-section" style="display:none;">
            <h2>5. Crie um Value Stream</h2>
            <input type="text" id="vs-name" placeholder="Nome do Value Stream">
            <input type="text" id="vs-desc" placeholder="Descrição (opcional)">
            <input type="text" id="vs-owner" placeholder="Responsável (opcional)">
            <button onclick="createValueStream()">Criar Value Stream</button>
            <div id="value-streams-list"></div>
        </section>
        <section id="dashboard-section" style="display:none;">
            <h2>6. Dashboard</h2>
            <div id="dashboard-content"></div>
        </section>
    </div>
    <script src="assets/app.js"><\/script>
</body>
</html>`,

  'frontend/assets/style.css': `* {margin: 0; padding: 0; box-sizing: border-box;}
body {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px;}
.container {max-width: 1000px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); padding: 40px;}
header {text-align: center; margin-bottom: 40px;}
header h1 {color: #333; margin-bottom: 10px;}
header p {color: #666; font-size: 16px;}
section {margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-left: 4px solid #667eea; border-radius: 4px;}
section h2 {color: #333; margin-bottom: 15px; font-size: 18px;}
input, select, button {padding: 10px 15px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;}
input, select {width: 100%; margin-bottom: 10px;}
button {background: #667eea; color: white; border: none; cursor: pointer; transition: background 0.3s ease;}
button:hover {background: #764ba2;}
#upload-status, #value-streams-list, #dashboard-content {margin-top: 15px; padding: 15px; background: white; border-radius: 4px; border: 1px solid #ddd;}
#upload-status.success {background: #d4edda; color: #155724; border-color: #c3e6cb;}
#upload-status.error {background: #f8d7da; color: #721c24; border-color: #f5c6cb;}
table {width: 100%; border-collapse: collapse; margin-top: 15px;}
table th, table td {padding: 10px; text-align: left; border-bottom: 1px solid #ddd;}
table th {background: #f0f0f0; font-weight: bold;}
table tr:hover {background: #f9f9f9;}`,

  'frontend/assets/app.js': `const API_BASE = "http://localhost:3000/api";
let currentClientId = null, currentProjectId = null, currentPodId = null;
document.addEventListener("DOMContentLoaded", () => { refreshClients(); });
async function refreshClients() {
  try {
    const res = await fetch(\`\${API_BASE}/clients\`);
    const clients = await res.json();
    const select = document.getElementById("client-select");
    select.innerHTML = '<option value="">-- Selecione um cliente --</option>';
    clients.forEach(c => {
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
    const res = await fetch(\`\${API_BASE}/clients\`, {
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
    const res = await fetch(\`\${API_BASE}/clients/\${currentClientId}/projects\`);
    const projects = await res.json();
    const select = document.getElementById("project-select");
    select.innerHTML = '<option value="">-- Selecione um projeto --</option>';
    projects.forEach(p => {
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
    const res = await fetch(\`\${API_BASE}/clients/\${currentClientId}/projects\`, {
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
    const res = await fetch(\`\${API_BASE}/clients/\${currentClientId}/pods\`);
    const pods = await res.json();
    const select = document.getElementById("pod-select");
    select.innerHTML = '<option value="">-- Selecione um POD --</option>';
    pods.forEach(p => {
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
    const res = await fetch(\`\${API_BASE}/clients/\${currentClientId}/pods\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, name, description: document.getElementById("pod-desc").value || "" }),
    });
    const pod = await res.json();
    alert("POD criado: " + pod.name);
    document.getElementById("pod-name").value = "";
    document.getElementById("pod-desc").value = "";
    loadPods();
    currentPodId = pod.id;
    document.getElementById("upload-section").style.display = "block";
    document.getElementById("value-stream-section").style.display = "block";
  } catch (err) {
    alert("Erro ao criar POD: " + err.message);
  }
}
document.addEventListener("change", (e) => {
  if (e.target.id === "project-select" && e.target.value) {
    currentProjectId = e.target.value;
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
    const res = await fetch(\`\${API_BASE}/uploads/\${currentClientId}/pods/\${podId}/uploads\`, {
      method: "POST",
      body: formData,
    });
    const result = await res.json();
    if (res.ok) {
      statusDiv.className = "success";
      statusDiv.innerHTML = \`✓ Upload realizado com sucesso!<br>Criadas: \${result.processing_result.created}<br>Atualizadas: \${result.processing_result.updated}\`;
    } else {
      statusDiv.className = "error";
      statusDiv.innerHTML = \`Erro: \${result.error}\`;
    }
  } catch (err) {
    statusDiv.className = "error";
    statusDiv.innerHTML = \`Erro: \${err.message}\`;
  }
}
async function loadValueStreams() {
  try {
    const res = await fetch(\`\${API_BASE}/value_streams/\${currentClientId}\`);
    const vss = await res.json();
    const list = document.getElementById("value-streams-list");
    list.innerHTML = "<h3>Value Streams</h3>";
    if (vss.length === 0) {
      list.innerHTML += "<p>Nenhum value stream criado ainda.</p>";
    } else {
      list.innerHTML += "<ul>";
      vss.forEach(vs => {
        list.innerHTML += \`<li><strong>\${vs.name}</strong> - \${vs.description || "Sem descrição"}</li>\`;
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
    const res = await fetch(\`\${API_BASE}/value_streams\`, {
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
});`
};

Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Created:', filePath);
});

console.log('\n✅ Todos os arquivos foram criados com sucesso!');
console.log('\nPróximos passos:');
console.log('1. npm install');
console.log('2. Copie o .env.example para .env');
console.log('3. npm start');

// Salvar e executar
fs.writeFileSync('setup.js', files);
console.log('Setup script created. Run: node setup.js');