import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { getSearchHistory, searchLeads } from "../api";
import { toast } from "../components/Toast";

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rerunId, setRerunId] = useState(null);
    const navigate = useNavigate();

    const fetchHistory = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const data = await getSearchHistory({ page: p, limit: 10 });
            setHistory(data.history);
            setTotal(data.total);
            setPages(data.pages);
            setPage(p);
        } catch (e) {
            toast("Failed to load history: " + e.message, "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHistory(1); }, [fetchHistory]);

    const handleRerun = async (query, id) => {
        setRerunId(id);
        try {
            const data = await searchLeads(query);
            toast(`Re-run done! ${data.leads_stored} new leads stored.`, "success");
            navigate("/leads");
        } catch (e) {
            toast("Re-run failed: " + e.message, "error");
        } finally {
            setRerunId(null);
        }
    };

    return (
        <div className="leads-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Search History</h1>
                    <p className="page-subtitle">All past queries with results — re-run any search instantly</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => fetchHistory(page)}>↺ Refresh</button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-label">Total Searches</div>
                    <div className="stat-value">{total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">This Page</div>
                    <div className="stat-value">{history.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Pages</div>
                    <div className="stat-value">{pages}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Current Page</div>
                    <div className="stat-value">{page}</div>
                </div>
            </div>

            {loading ? (
                <Loader text="Loading history…" />
            ) : (
                <div className="table-card">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Query</th>
                                    <th>Generated Google Query</th>
                                    <th style={{ textAlign: "center" }}>Results</th>
                                    <th>Date &amp; Time</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="empty-state">
                                                <div className="empty-icon">🕑</div>
                                                <p>No search history yet. Run your first search!</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id}>
                                            <td className="td-name">{h.user_query}</td>
                                            <td className="td-muted" style={{ fontFamily: "monospace", fontSize: "0.78rem", maxWidth: 240 }}>
                                                {h.filters_generated}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <span className="status-badge status-new">{h.total_results}</span>
                                            </td>
                                            <td className="td-muted">{formatDate(h.created_at)}</td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleRerun(h.user_query, h.id)}
                                                    disabled={rerunId === h.id}
                                                >
                                                    {rerunId === h.id ? "Running…" : "▶ Re-run"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">
                                Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}
                            </div>
                            <div className="pagination-controls">
                                <button className="page-btn" disabled={page === 1} onClick={() => fetchHistory(1)}>«</button>
                                <button className="page-btn" disabled={page === 1} onClick={() => fetchHistory(page - 1)}>‹</button>
                                {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((n) => (
                                    <button key={n} className={`page-btn ${n === page ? "active" : ""}`} onClick={() => fetchHistory(n)}>{n}</button>
                                ))}
                                <button className="page-btn" disabled={page === pages} onClick={() => fetchHistory(page + 1)}>›</button>
                                <button className="page-btn" disabled={page === pages} onClick={() => fetchHistory(pages)}>»</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
