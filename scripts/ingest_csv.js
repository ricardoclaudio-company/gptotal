const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const supabase = require("../backend/lib/supabase");
const { processUpload } = require("../backend/lib/ingest");

const csvFile = process.argv[2];
const clientId = process.argv[3];
const podId = process.argv[4];

if (!csvFile || !clientId || !podId) {
  console.error("Usage: node scripts/ingest_csv.js <csv-file> <client-id> <pod-id>");
  process.exit(1);
}

(async () => {
  try {
    if (!fs.existsSync(csvFile)) {
      throw new Error(`File not found: ${csvFile}`);
    }

    const buffer = fs.readFileSync(csvFile);
    const rows = await new Promise((resolve, reject) => {
      Papa.parse(buffer.toString("utf8"), {
        complete: (result) => resolve(result.data),
        header: true,
        error: (err) => reject(err),
      });
    });

    const { data: uploadRecord, error: uploadErr } = await supabase
      .from("uploads")
      .insert([{ client_id: clientId, pod_id: podId, source_type: "csv", source_ref: path.basename(csvFile), status: "pending" }])
      .select();

    if (uploadErr) throw uploadErr;
    const uploadId = uploadRecord[0].id;

    const result = await processUpload(uploadId, rows, clientId, podId);
    console.log("Ingest result:", result);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
