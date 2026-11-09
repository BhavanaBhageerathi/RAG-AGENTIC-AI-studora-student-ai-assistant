import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("auth/register/", {
        username: username.trim(),
        email: email.trim(),
        password: password,
      });

      setSuccess("Account created successfully! Logging you in...");

      if (onLogin) {
        await onLogin(username.trim(), password);
        navigate("/");
      } else {
        setTimeout(() => navigate("/login"), 1200);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const messages = Object.entries(data)
          .map(([key, val]) => {
            const text = Array.isArray(val) ? val.join(" ") : String(val);
            return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${text}`;
          })
          .join(" ");
        setError(messages || "Registration failed. Please check your inputs.");
      } else {
        setError("Unable to connect to Studora. Make sure Django is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div className="login-brand-icon">
          <i className="bi bi-book-half"></i>
          <i className="bi bi-stars"></i>
        </div>
        <h2>STUDORA - STUDENT AI ASSISTANT</h2>
      </div>
      <div className="login-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-logo">
            <i className="bi bi-person-plus-fill"></i>
            <i className="bi bi-stars"></i>
          </div>
          <h1>Create account</h1>
          <p className="muted-text">Start your smart learning journey today.</p>

          <label className="form-label" htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            className="form-control custom-input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
          />

          <label className="form-label mt-3" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            className="form-control custom-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />

          <label className="form-label mt-3" htmlFor="reg-password">Password (min. 8 characters)</label>
          <input
            id="reg-password"
            className="form-control custom-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
          />

          <label className="form-label mt-3" htmlFor="reg-confirm-password">Confirm Password</label>
          <input
            id="reg-confirm-password"
            className="form-control custom-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
          />

          {error && <div className="alert alert-danger mt-3 py-2" role="alert">{error}</div>}
          {success && <div className="alert alert-success mt-3 py-2" role="alert">{success}</div>}

          <button className="primary-button w-100 mt-4" type="submit" disabled={loading}>
            {loading ? "Creating account..." : <>Sign up <i className="bi bi-arrow-right"></i></>}
          </button>
          <div className="login-note mt-3">
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#6554ad", fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
