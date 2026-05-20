const express = require("express");
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

module.exports = router;
