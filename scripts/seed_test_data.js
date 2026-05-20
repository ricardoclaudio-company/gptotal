const supabase = require("../backend/lib/supabase");

(async () => {
  try {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert([{ name: "Client Seed Test", metadata: { seed: true } }])
      .select()
      .single();

    if (clientError) throw clientError;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert([{ client_id: client.id, name: "Projeto Seed", description: "Projeto gerado por seed" }])
      .select()
      .single();

    if (projectError) throw projectError;

    const { data: pod, error: podError } = await supabase
      .from("pods")
      .insert([{ client_id: client.id, project_id: project.id, name: "POD Seed", description: "POD gerado por seed" }])
      .select()
      .single();

    if (podError) throw podError;

    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert([{ client_id: client.id, pod_id: pod.id, source_type: "csv", source_ref: "seed.csv", status: "processed", row_count: 0 }])
      .select()
      .single();

    if (uploadError) throw uploadError;

    console.log("Seed data inserted:", {
      client: client.id,
      project: project.id,
      pod: pod.id,
      upload: upload.id,
    });
  } catch (err) {
    console.error("Seed failed:", err.message || err);
    process.exit(1);
  }
})();
