const express = require("express");
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

module.exports = router;
