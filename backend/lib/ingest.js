const supabase = require("./supabase");

async function normalizeIssues(rows, clientId, podId, uploadId) {
  return rows.map((row, idx) => ({
    client_id: clientId,
    pod_id: podId,
    upload_id: uploadId,
    issue_key: row.issue_key || row.issueKey || row.key || "",
    issue_type: row.issue_type || row.issueType || row.type || "Task",
    summary: row.summary || row.title || "",
    status: row.status || "To Do",
    assignee: row.assignee || null,
    priority: row.priority || null,
    epic_link: row.epic_link || row.epicLink || null,
    parent_issue_key: row.parent_issue_key || row.parentIssueKey || null,
    original_estimate: row.original_estimate || row.originalEstimate || null,
    story_points: row.story_points || row.storyPoints ? parseFloat(row.story_points || row.storyPoints) : null,
    due_date: row.due_date || row.dueDate || null,
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

    return {
      success: true,
      created: result.created.length,
      updated: result.updated.length,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  normalizeIssues,
  upsertIssues,
  reconcileParentChild,
  processUpload,
};
