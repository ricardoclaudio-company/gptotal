const express = require("express");
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

router.put("/:value_stream_id", async (req, res) => {
  try {
    const { name, description, owner } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const { data, error } = await supabase
      .from("value_streams")
      .update({ name, description, owner })
      .eq("id", req.params.value_stream_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:value_stream_id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("value_streams")
      .delete()
      .eq("id", req.params.value_stream_id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
