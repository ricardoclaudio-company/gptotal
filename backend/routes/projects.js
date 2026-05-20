const express = require("express");
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

module.exports = router;
