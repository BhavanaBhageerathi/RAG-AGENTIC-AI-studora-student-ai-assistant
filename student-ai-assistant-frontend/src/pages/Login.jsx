import { useState } from "react";
import { Link } from "react-router-dom";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail) {
        setError("Invalid username or password. Please try again.");
      } else if (data && typeof data === "object") {
        setError(Object.values(data).flat().join(" "));
      } else {
        setError("Unable to connect to Studora. Check that Django is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div className="login-brand-icon"><i className="bi bi-book-half"></i><i className="bi bi-stars"></i></div>
        <h2>STUDORA - STUDENT AI ASSISTANT</h2>
      </div>
      <div className="login-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-logo"><i className="bi bi-book-half"></i><i className="bi bi-stars"></i></div>
          <h1>Welcome back</h1>
          <p className="muted-text">Let’s make today count.</p>

          <label className="form-label" htmlFor="username">Username</label>
          <input id="username" className="form-control custom-input" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username" />

          <label className="form-label mt-3" htmlFor="password">Password</label>
          <input id="password" className="form-control custom-input" type="password"
            autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />

          {error && <div className="alert alert-danger mt-3 py-2" role="alert">{error}</div>}

          <button className="primary-button w-100 mt-4" type="submit" disabled={loading}>
            {loading ? "Signing in..." : <>Sign in <i className="bi bi-arrow-right"></i></>}
          </button>
          <div className="login-note mt-3">
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#6554ad", fontWeight: 600, textDecoration: "none" }}>
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
export default Login;
