import { useState, useCallback } from "react";

let _setToasts = null;

export function useToast() {
    const [toasts, setToasts] = useState([]);
    _setToasts = setToasts;

    const addToast = useCallback((message, type = "info", duration = 3500) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    return { toasts, addToast };
}

export function toast(message, type = "info") {
    if (_setToasts) {
        const id = Date.now();
        _setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            _setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }
}

export function ToastContainer({ toasts }) {
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span>{icons[t.type] || "ℹ"}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
