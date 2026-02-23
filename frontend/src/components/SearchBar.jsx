import { useState } from "react";

const HINTS = [
    "CEOs in Mumbai",
    "Software Engineers at Google",
    "VPs of Marketing in Bangalore",
    "Founders in Delhi",
];

export default function SearchBar({ onSearch, loading }) {
    const [query, setQuery] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!query.trim() || loading) return;
        onSearch(query.trim());
    };

    const handleHint = (hint) => {
        setQuery(hint);
        onSearch(hint);
    };

    return (
        <div className="search-wrapper">
            <form className="search-box" onSubmit={handleSubmit}>
                <span className="search-icon">🔍</span>
                <input
                    className="search-input"
                    type="text"
                    placeholder="e.g. 'CEOs in Mumbai' or 'SDEs at Google from Pune'"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                    autoFocus
                />
                <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
                    {loading ? (
                        <>
                            <span
                                style={{
                                    width: 16,
                                    height: 16,
                                    border: "2px solid rgba(255,255,255,0.3)",
                                    borderTopColor: "#fff",
                                    borderRadius: "50%",
                                    display: "inline-block",
                                    animation: "spin 0.7s linear infinite",
                                }}
                            />
                            Searching…
                        </>
                    ) : (
                        <>⚡ Find Leads</>
                    )}
                </button>
            </form>

            <div className="search-hints">
                {HINTS.map((h) => (
                    <button key={h} className="hint-chip" onClick={() => handleHint(h)} disabled={loading}>
                        {h}
                    </button>
                ))}
            </div>
        </div>
    );
}
