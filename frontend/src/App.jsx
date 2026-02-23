import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import LeadsPage from "./pages/LeadsPage";
import HistoryPage from "./pages/HistoryPage";
import { useToast, ToastContainer } from "./components/Toast";
import "./index.css";

export default function App() {
  const { toasts } = useToast();

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Navbar */}
        <nav className="navbar">
          <NavLink to="/" className="navbar-brand">
            <div className="brand-icon">⚡</div>
            LeadIntel AI
          </NavLink>
          <div className="navbar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              🔍 Search
            </NavLink>
            <NavLink
              to="/leads"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              📊 Dashboard
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              🕑 History
            </NavLink>
          </div>
        </nav>

        {/* Pages */}
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>

        <ToastContainer toasts={toasts} />
      </div>
    </BrowserRouter>
  );
}
