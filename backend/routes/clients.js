const express = require("express");
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
    const { name, description, metadata } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const payload = { name, metadata: metadata || {} };
    if (description) payload.metadata.description = description;

    const { data, error } = await supabase
      .from("clients")
      .insert([payload])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:client_id", async (req, res) => {
  try {
    const { name, description, metadata } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const payload = { name, metadata: metadata || {} };
    if (description) payload.metadata.description = description;

    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", req.params.client_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:client_id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", req.params.client_id);

    if (error) throw error;
    res.status(204).end();
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

module.exports = router;
