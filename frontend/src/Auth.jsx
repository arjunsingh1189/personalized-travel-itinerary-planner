import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Account ban gaya. Email confirm karke login kar.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>✈️ Travel Itinerary Planner</h1>
      <p className="subtitle">Trips save karne ke liye login kar.</p>

      <form className="card" onSubmit={submit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password (min 6 characters)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />

        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Wait..." : mode === "login" ? "Login" : "Sign up"}
        </button>

        {msg && <p className="error">{msg}</p>}

        <p className="switch" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Naya account banana hai? Sign up" : "Pehle se account hai? Login"}
        </p>
      </form>
    </div>
  );
}