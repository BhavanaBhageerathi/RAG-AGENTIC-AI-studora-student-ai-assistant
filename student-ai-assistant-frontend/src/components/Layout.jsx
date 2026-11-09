import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";

function Layout({ userName, onLogout, onNewChat }) {
  const navigate = useNavigate();
  const location = useLocation();
  function newChat() {
    onNewChat();
    navigate("/");
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <button className="brand-button" onClick={() => navigate("/")}>
          <span className="brand-icon"><i className="bi bi-stars"></i></span>
          <span>Studora</span>
        </button>
        <button className="new-chat-button" onClick={newChat}><i className="bi bi-plus-lg"></i> New chat</button>
        <nav className="sidebar-menu">
          <NavLink end to="/" className={({ isActive }) => "sidebar-item " + (isActive ? "active" : "")}><i className="bi bi-house-door"></i> Home</NavLink>
          <NavLink to="/documents" className={({ isActive }) => "sidebar-item " + (isActive ? "active" : "")}><i className="bi bi-folder2-open"></i> My documents</NavLink>
          <NavLink to="/history" className={({ isActive }) => "sidebar-item " + (isActive ? "active" : "")}><i className="bi bi-clock-history"></i> Chat history</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user"><span className="avatar">{userName.charAt(0).toUpperCase()}</span><span>{userName}</span></div>
          <button className="logout-link" onClick={() => { onLogout(); navigate("/login"); }}><i className="bi bi-box-arrow-left"></i> Log out</button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <span className="mobile-brand"><i className="bi bi-stars"></i> Studora</span>
          <div className="topbar-right"><span className="status-dot"></span><span>{userName}</span><span className="avatar small-avatar">{userName.charAt(0).toUpperCase()}</span></div>
        </header>
        <div className="page-area"><Outlet /></div>
      </main>
    </div>
  );
}
export default Layout;