import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "./supabase";
import Auth from "./Auth";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const INTEREST_OPTIONS = ["food", "beaches", "sightseeing", "adventure", "culture", "shopping", "nightlife", "nature"];
const STYLES = ["relaxed", "adventure", "luxury", "budget"];

const calcTotal = (it) =>
  Math.round(
    it.days.reduce(
      (sum, d) => sum + d.activities.reduce((s, a) => s + a.estimated_cost, 0),
      0
    )
  );

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [form, setForm] = useState({
    destination: "",
    start_date: "",
    end_date: "",
    budget: 15000,
    travel_style: "relaxed",
    group_size: 1,
    interests: [],
  });
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [tripId, setTripId] = useState(null);
  const [regenDay, setRegenDay] = useState(null);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadTrips();
    else setTrips([]);
  }, [session]);

  const loadTrips = async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTrips(data);
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  const toggleInterest = (item) => {
    const has = form.interests.includes(item);
    update("interests", has ? form.interests.filter((i) => i !== item) : [...form.interests, item]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setTripId(null);
    setItinerary(null);

    if (!form.destination || !form.start_date || !form.end_date) {
      setError("Destination aur dono dates bharo.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("End date start date se pehle nahi ho sakti.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/generate`,
        { ...form, budget: Number(form.budget), group_size: Number(form.group_size) },
        { timeout: 90000 }
      );
      setItinerary(res.data);
    } catch (err) {
      setError("Itinerary nahi bani. Backend chal raha hai? Dobara try kar.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const regenerateDay = async (dayNum) => {
    setError("");
    setRegenDay(dayNum);
    try {
      const avoid = itinerary.days
        .filter((d) => d.day !== dayNum)
        .flatMap((d) => d.activities.map((a) => a.title));

      const res = await axios.post(
        `${API_URL}/regenerate-day`,
        {
          destination: form.destination,
          budget: Number(form.budget),
          travel_style: form.travel_style,
          group_size: Number(form.group_size),
          interests: form.interests,
          day: dayNum,
          total_days: itinerary.days.length,
          avoid,
        },
        { timeout: 90000 }
      );

      setItinerary({
        ...itinerary,
        days: itinerary.days.map((d) => (d.day === dayNum ? res.data : d)),
      });
      setSaved(false);
    } catch (err) {
      setError("Ye din dobara nahi bana. Phir try kar.");
      console.error(err);
    } finally {
      setRegenDay(null);
    }
  };

  const saveTrip = async () => {
    const payload = {
      destination: form.destination,
      start_date: form.start_date,
      end_date: form.end_date,
      budget: Number(form.budget),
      travel_style: form.travel_style,
      group_size: Number(form.group_size),
      interests: form.interests,
      itinerary,
      total_cost: calcTotal(itinerary),
    };

    if (tripId) {
      const { error } = await supabase.from("trips").update(payload).eq("id", tripId);
      if (error) return setError("Update nahi hua: " + error.message);
    } else {
      const { data, error } = await supabase.from("trips").insert(payload).select().single();
      if (error) return setError("Save nahi hua: " + error.message);
      setTripId(data.id);
    }
    setError("");
    setSaved(true);
    loadTrips();
  };

  const openTrip = (t) => {
    setForm({
      destination: t.destination,
      start_date: t.start_date,
      end_date: t.end_date,
      budget: t.budget,
      travel_style: t.travel_style,
      group_size: t.group_size,
      interests: t.interests || [],
    });
    setItinerary(t.itinerary);
    setTripId(t.id);
    setSaved(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTrip = async (id) => {
    await supabase.from("trips").delete().eq("id", id);
    if (id === tripId) setTripId(null);
    loadTrips();
  };

  if (!authReady) return <div className="container">Loading...</div>;
  if (!session) return <Auth />;

  return (
    <div className="container">
      <div className="topbar noprint">
        <h1>✈️ Travel Planner</h1>
        <div>
          <span className="email">{session.user.email}</span>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
      </div>
      <p className="subtitle noprint">Apni trip batao, AI plan bana dega.</p>

      <form className="card noprint" onSubmit={handleSubmit}>
        <label>Destination</label>
        <input
          type="text"
          placeholder="Jaise: Goa, Manali, Jaipur"
          value={form.destination}
          onChange={(e) => update("destination", e.target.value)}
        />

        <div className="row">
          <div>
            <label>Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </div>
          <div>
            <label>End date</label>
            <input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Total budget (₹)</label>
            <input type="number" min="0" value={form.budget} onChange={(e) => update("budget", e.target.value)} />
          </div>
          <div>
            <label>Group size</label>
            <input type="number" min="1" value={form.group_size} onChange={(e) => update("group_size", e.target.value)} />
          </div>
        </div>

        <label>Travel style</label>
        <select value={form.travel_style} onChange={(e) => update("travel_style", e.target.value)}>
          {STYLES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label>Interests</label>
        <div className="chips">
          {INTEREST_OPTIONS.map((item) => (
            <button
              type="button"
              key={item}
              className={form.interests.includes(item) ? "chip active" : "chip"}
              onClick={() => toggleInterest(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Plan ban raha hai..." : "Generate Itinerary"}
        </button>
      </form>

      {error && <p className="error noprint">{error}</p>}

      {itinerary && (
        <div className="result">
          <div className="resulthead">
            <h2>
              {form.destination} trip, total estimate: ₹{calcTotal(itinerary)}
            </h2>
            <div className="btns noprint">
              <button className="secondary" onClick={saveTrip} disabled={saved}>
                {saved ? "Saved ✅" : tripId ? "💾 Update trip" : "💾 Save trip"}
              </button>
              <button className="secondary" onClick={() => window.print()}>
                📄 Download PDF
              </button>
            </div>
          </div>

          {itinerary.days.map((day) => (
            <div className="card day" key={day.day}>
              <div className="dayhead">
                <h3>Day {day.day}</h3>
                <button
                  className="secondary noprint"
                  onClick={() => regenerateDay(day.day)}
                  disabled={regenDay !== null}
                >
                  {regenDay === day.day ? "Ban raha hai..." : "🔄 Regenerate this day"}
                </button>
              </div>
              <p className="summary">{day.summary}</p>
              {day.activities.map((act, i) => (
                <div className="activity" key={i}>
                  <div className="time">{act.time}</div>
                  <div className="info">
                    <div className="title">
                      {act.title}
                      <span className={`badge ${act.type}`}>{act.type}</span>
                    </div>
                    <div className="desc">{act.description}</div>
                  </div>
                  <div className="cost">₹{Math.round(act.estimated_cost)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="saved noprint">
        <h2>Meri saved trips</h2>
        {trips.length === 0 && <p className="subtitle">Abhi koi trip save nahi hui.</p>}
        {trips.map((t) => (
          <div className="card savedtrip" key={t.id}>
            <div>
              <div className="title">{t.destination}</div>
              <div className="desc">
                {t.start_date} se {t.end_date} · ₹{Math.round(t.total_cost)}
              </div>
            </div>
            <div className="btns">
              <button className="secondary" onClick={() => openTrip(t)}>Open</button>
              <button className="secondary danger" onClick={() => deleteTrip(t.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}