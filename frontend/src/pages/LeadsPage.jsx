import { useState, useEffect, useCallback } from "react";
import LeadsTable from "../components/LeadsTable";
import Loader from "../components/Loader";
import { getLeads, downloadLeadsUrl } from "../api";
import { toast } from "../components/Toast";

const STATUS_OPTIONS = ["", "New", "Contacted", "Qualified", "Rejected"];

export default function LeadsPage() {
    const [leads, setLeads] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [sortBy, setSortBy] = useState("created_at");
    const [order, setOrder] = useState("desc");

    const fetchLeads = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const data = await getLeads({ page: p, limit: 10, search, sort_by: sortBy, order, status: statusFilter });
            setLeads(data.leads);
            setTotal(data.total);
            setPages(data.pages);
            setPage(data.page);
        } catch (e) {
            toast("Failed to load leads: " + e.message, "error");
        } finally {
            setLoading(false);
        }
    }, [search, sortBy, order, statusFilter]);

    useEffect(() => {
        fetchLeads(1);
        setPage(1);
    }, [search, sortBy, order, statusFilter]);

    const handleSort = (col, dir) => {
        setSortBy(col);
        setOrder(dir);
    };

    const handlePageChange = (p) => {
        setPage(p);
        fetchLeads(p);
    };

    const handleDownload = () => {
        window.open(downloadLeadsUrl({ search, status: statusFilter, sort_by: sortBy, order }), "_blank");
        toast("CSV download started!", "success");
    };

    const statsItems = [
        { label: "Total Leads", value: total },
        { label: "This Page", value: leads.length },
        { label: "Total Pages", value: pages || 0 },
        { label: "Current Page", value: page },
    ];

    return (
        <div className="leads-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Leads Dashboard</h1>
                    <p className="page-subtitle">All discovered leads, sorted and searchable</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => fetchLeads(page)}>
                        ↺ Refresh
                    </button>
                    <button className="btn btn-primary" onClick={handleDownload}>
                        ⬇️ Download CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
                {statsItems.map((s) => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value">{s.value.toLocaleString()}</div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="filter-bar">
                <input
                    className="filter-input"
                    placeholder="🔍  Search by name, company, title, location…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    title="Filter by status"
                >
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s === "" ? "All Statuses" : s}</option>
                    ))}
                </select>
                <select
                    className="filter-select"
                    value={`${sortBy}:${order}`}
                    onChange={(e) => {
                        const [col, dir] = e.target.value.split(":");
                        setSortBy(col);
                        setOrder(dir);
                    }}
                >
                    <option value="created_at:desc">Newest First</option>
                    <option value="created_at:asc">Oldest First</option>
                    <option value="name:asc">Name A–Z</option>
                    <option value="name:desc">Name Z–A</option>
                    <option value="company:asc">Company A–Z</option>
                    <option value="job_title:asc">Title A–Z</option>
                </select>
            </div>

            {/* Table / Loader */}
            {loading ? (
                <Loader text="Fetching leads…" />
            ) : (
                <LeadsTable
                    leads={leads}
                    total={total}
                    page={page}
                    pages={pages}
                    onPageChange={handlePageChange}
                    onSort={handleSort}
                    sortBy={sortBy}
                    order={order}
                />
            )}
        </div>
    );
}
