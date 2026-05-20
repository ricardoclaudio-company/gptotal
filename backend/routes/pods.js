const express = require("express");
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

router.put("/:client_id/pods/:pod_id", async (req, res) => {
  try {
    const { name, description, project_id } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    if (!project_id) return res.status(400).json({ error: "project_id is required" });

    const { data, error } = await supabase
      .from("pods")
      .update({ name, description, project_id })
      .eq("id", req.params.pod_id)
      .eq("client_id", req.params.client_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:client_id/pods/:pod_id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("pods")
      .delete()
      .eq("id", req.params.pod_id)
      .eq("client_id", req.params.client_id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
