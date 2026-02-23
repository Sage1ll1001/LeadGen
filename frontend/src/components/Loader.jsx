export default function Loader({ text = "Loading…" }) {
    return (
        <div className="loader-overlay">
            <div className="spinner" />
            <div className="loader-text">{text}</div>
        </div>
    );
}
