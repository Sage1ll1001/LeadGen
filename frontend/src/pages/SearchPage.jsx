import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { searchLeads } from "../api";
import { toast } from "../components/Toast";

export default function SearchPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const navigate = useNavigate();

    const handleSearch = async (query) => {
        setLoading(true);
        setResult(null);
        try {
            const data = await searchLeads(query);
            setResult(data);
            toast(`Found ${data.leads_scraped} leads! ${data.leads_stored} new stored.`, "success");
        } catch (e) {
            toast("Search failed: " + e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="hero">
            <div className="hero-badge">
                <span>⚡</span> AI-Powered B2B Lead Generation
            </div>

            <h1 className="hero-title">
                Find leads with{" "}
                <span className="gradient-text">natural language</span>
            </h1>

            <p className="hero-subtitle">
                Just describe who you're looking for. Our AI converts it into a smart
                search, scrapes LinkedIn profiles, and stores qualified leads — instantly.
            </p>

            <SearchBar onSearch={handleSearch} loading={loading} />

            {result && (
                <div className="result-banner" style={{ marginTop: "2rem", maxWidth: 680, width: "100%" }}>
                    <span className="result-icon">🎯</span>
                    <div>
                        <div>
                            <strong>{result.leads_scraped}</strong> leads found ·{" "}
                            <strong>{result.leads_stored}</strong> new leads stored
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 4 }}>
                            Query: <em>{result.google_query}</em>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: "auto" }}
                        onClick={() => navigate("/leads")}
                    >
                        View Dashboard →
                    </button>
                </div>
            )}

            {/* Feature pills */}
            <div style={{ display: "flex", gap: 20, marginTop: "3rem", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                    { icon: "🤖", text: "AI Query Parsing" },
                    { icon: "🔍", text: "LinkedIn Scraping" },
                    { icon: "📊", text: "Smart Dashboard" },
                    { icon: "✉️", text: "AI Outreach Emails" },
                    { icon: "⬇️", text: "CSV Export" },
                ].map((f) => (
                    <div key={f.text} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 16px", borderRadius: "100px",
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        fontSize: "0.82rem", color: "var(--text-secondary)"
                    }}>
                        <span>{f.icon}</span> {f.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
