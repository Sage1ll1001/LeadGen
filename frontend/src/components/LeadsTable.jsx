import { useState, useEffect, useRef } from "react";
import { generateEmail, updateLead } from "../api";
import { toast } from "./Toast";

const SORT_COLS = [
    { key: "name", label: "Name" },
    { key: "company", label: "Company" },
    { key: "job_title", label: "Job Title" },
    { key: "location", label: "Location" },
    { key: "created_at", label: "Date" },
];

const STATUS_OPTIONS = ["New", "Contacted", "Qualified", "Rejected"];

// ── Email Modal ────────────────────────────────────────────────────
function EmailModal({ lead, onClose }) {
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        generateEmail(lead)
            .then(setEmail)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCopy = () => {
        if (!email) return;
        const text = `Subject: ${email.subject}\n\n${email.body}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div>
                        <div className="modal-title">✉️ AI-Generated Outreach</div>
                        <div className="modal-subtitle">
                            Personalized for {lead.name} · {lead.job_title || ""} {lead.company ? `at ${lead.company}` : ""}
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading && (
                        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                            <div className="spinner" style={{ margin: "0 auto 1rem" }} />
                            Generating personalized email…
                        </div>
                    )}
                    {error && (
                        <div style={{ color: "var(--danger)", padding: "1rem", textAlign: "center" }}>
                            ⚠️ {error}
                        </div>
                    )}
                    {email && (
                        <>
                            <div className="email-label">Subject</div>
                            <div className="email-subject">{email.subject}</div>
                            <div className="email-label" style={{ marginTop: "12px" }}>Email Body</div>
                            <div className="email-body-wrap">
                                <div className="email-body">{email.body}</div>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
                    {email && (
                        <button className="btn btn-primary btn-sm" onClick={handleCopy}>
                            {copied ? "✓ Copied!" : "📋 Copy Email"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Status Cell ───────────────────────────────────────────────────
function StatusCell({ lead, onUpdate }) {
    const [status, setStatus] = useState(lead.status || "New");
    const [saving, setSaving] = useState(false);

    const handleChange = async (e) => {
        const newStatus = e.target.value;
        setStatus(newStatus);
        setSaving(true);
        try {
            await updateLead(lead.id, { status: newStatus });
            onUpdate(lead.id, { status: newStatus });
            toast(`Status updated to ${newStatus}`, "success");
        } catch (err) {
            toast("Failed to update status: " + err.message, "error");
            setStatus(lead.status || "New"); // revert
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="status-cell">
            <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
            <select
                className="status-select"
                value={status}
                onChange={handleChange}
                disabled={saving}
                title="Change status"
            >
                {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
        </div>
    );
}

// ── Notes Cell ────────────────────────────────────────────────────
function NotesCell({ lead, onUpdate }) {
    const [notes, setNotes] = useState(lead.notes || "");
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(notes);
    const [saving, setSaving] = useState(false);
    const taRef = useRef(null);

    const startEdit = () => {
        setDraft(notes);
        setEditing(true);
        setTimeout(() => taRef.current?.focus(), 0);
    };

    const handleBlur = async () => {
        setEditing(false);
        if (draft === notes) return;
        setSaving(true);
        try {
            await updateLead(lead.id, { notes: draft });
            setNotes(draft);
            onUpdate(lead.id, { notes: draft });
            toast("Notes saved", "success");
        } catch (err) {
            toast("Failed to save notes: " + err.message, "error");
            setDraft(notes); // revert
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="notes-cell">
            {editing ? (
                <textarea
                    ref={taRef}
                    className="notes-textarea"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={handleBlur}
                    rows={3}
                    placeholder="Add notes…"
                />
            ) : (
                <div className="notes-preview" onClick={startEdit} title="Click to edit">
                    {saving ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Saving…</span>
                    ) : notes ? (
                        <span className="notes-text">{notes}</span>
                    ) : (
                        <span className="notes-empty">✏️ Add note</span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Table Component ──────────────────────────────────────────
export default function LeadsTable({ leads: initialLeads, total, page, pages, onPageChange, onSort, sortBy, order }) {
    const [leads, setLeads] = useState(initialLeads);
    const [selectedLead, setSelectedLead] = useState(null);

    // Sync with parent when initialLeads changes (e.g. pagination)
    useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

    const handleLeadUpdate = (id, patch) => {
        setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
    };

    const handleSort = (col) => {
        if (col === sortBy) {
            onSort(col, order === "asc" ? "desc" : "asc");
        } else {
            onSort(col, "desc");
        }
    };

    const sortIcon = (col) => {
        if (col !== sortBy) return <span className="sort-icon">↕</span>;
        return <span className="sort-icon">{order === "asc" ? "↑" : "↓"}</span>;
    };

    const pageNumbers = () => {
        const nums = [];
        const delta = 2;
        for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
            nums.push(i);
        }
        return nums;
    };

    return (
        <>
            <div className="table-card">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                {SORT_COLS.map((col) => (
                                    <th
                                        key={col.key}
                                        className={sortBy === col.key ? "sorted" : ""}
                                        onClick={() => handleSort(col.key)}
                                    >
                                        {col.label} {sortIcon(col.key)}
                                    </th>
                                ))}
                                <th>Status</th>
                                <th>Notes</th>
                                <th>Email</th>
                                <th>LinkedIn</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.length === 0 ? (
                                <tr>
                                    <td colSpan={10}>
                                        <div className="empty-state">
                                            <div className="empty-icon">📭</div>
                                            <p>No leads found. Run a search to populate this table.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead) => (
                                    <tr key={lead.id}>
                                        <td className="td-name">{lead.name || "—"}</td>
                                        <td className="td-muted">{lead.company || "—"}</td>
                                        <td className="td-muted">{lead.job_title || "—"}</td>
                                        <td className="td-muted">{lead.location || "—"}</td>
                                        <td className="td-muted">
                                            {lead.created_at
                                                ? new Date(lead.created_at).toLocaleDateString()
                                                : "—"}
                                        </td>
                                        <td>
                                            <StatusCell lead={lead} onUpdate={handleLeadUpdate} />
                                        </td>
                                        <td>
                                            <NotesCell lead={lead} onUpdate={handleLeadUpdate} />
                                        </td>
                                        <td className="td-email">{lead.email || <span style={{ color: "var(--text-muted)" }}>N/A</span>}</td>
                                        <td className="td-link">
                                            {lead.linkedin_url ? (
                                                <a href={lead.linkedin_url} target="_blank" rel="noreferrer">
                                                    <span>🔗</span> View
                                                </a>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setSelectedLead(lead)}
                                            >
                                                ✉️ Email
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {leads.length > 0 && (
                    <div className="pagination">
                        <div className="pagination-info">
                            Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} leads
                        </div>
                        <div className="pagination-controls">
                            <button className="page-btn" disabled={page === 1} onClick={() => onPageChange(1)} title="First">«</button>
                            <button className="page-btn" disabled={page === 1} onClick={() => onPageChange(page - 1)} title="Prev">‹</button>
                            {pageNumbers().map((n) => (
                                <button
                                    key={n}
                                    className={`page-btn ${n === page ? "active" : ""}`}
                                    onClick={() => onPageChange(n)}
                                >
                                    {n}
                                </button>
                            ))}
                            <button className="page-btn" disabled={page === pages || pages === 0} onClick={() => onPageChange(page + 1)} title="Next">›</button>
                            <button className="page-btn" disabled={page === pages || pages === 0} onClick={() => onPageChange(pages)} title="Last">»</button>
                        </div>
                    </div>
                )}
            </div>

            {selectedLead && (
                <EmailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
            )}
        </>
    );
}
