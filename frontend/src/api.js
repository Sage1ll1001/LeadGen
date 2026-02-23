const API_BASE = "http://127.0.0.1:8000";

export async function searchLeads(query) {
  const res = await fetch(`${API_BASE}/search-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLeads({ page = 1, limit = 10, search = "", sort_by = "created_at", order = "desc" } = {}) {
  const params = new URLSearchParams({ page, limit, search, sort_by, order });
  const res = await fetch(`${API_BASE}/leads?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateEmail(lead) {
  const res = await fetch(`${API_BASE}/generate-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function downloadLeadsUrl() {
  return `${API_BASE}/download-leads`;
}
