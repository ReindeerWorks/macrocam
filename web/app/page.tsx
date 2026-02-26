"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type MacroResult = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function Page() {
  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#2563eb",
    color: "white",
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    fontSize: "16px",
    fontWeight: "600",
    marginTop: "12px",
    cursor: "pointer",
    width: "260px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px",
    fontSize: "16px",
    marginTop: "8px",
    marginBottom: "8px",
    borderRadius: "8px",
    border: "1px solid #444",
    width: "260px",
    backgroundColor: "#111",
    color: "white",
  };

  const containerStyle: React.CSSProperties = {
    padding: "20px",
    fontFamily: "system-ui, sans-serif",
    backgroundColor: "#000",
    color: "white",
    minHeight: "100vh",
  };

  const cardStyle: React.CSSProperties = {
    marginTop: "20px",
    padding: "15px",
    backgroundColor: "#111",
    borderRadius: "12px",
    width: "260px",
  };

  const [email, setEmail] = useState<string>("");
  const [pw, setPw] = useState<string>("");

  const [session, setSession] = useState<any>(null);

  const [file, setFile] = useState<File | null>(null);

  const [result, setResult] = useState<MacroResult | null>(null);

  const [meals, setMeals] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUpOrIn() {
    setError(null);

    const signIn = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    if (!signIn.error) return;

    const signUp = await supabase.auth.signUp({
      email,
      password: pw,
    });

    if (signUp.error) setError(signUp.error.message);
  }

  async function loadMeals() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .gte("meal_time", startOfTodayISO())
      .lte("meal_time", endOfTodayISO())
      .order("meal_time", { ascending: false });

    if (!error && data) {
      setMeals(data);
    }
  }

  useEffect(() => {
    loadMeals();
  }, [session]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        protein: acc.protein + Number(m.protein_g || 0),
        carbs: acc.carbs + Number(m.carbs_g || 0),
        fat: acc.fat + Number(m.fat_g || 0),
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    );
  }, [meals]);

  async function analyzeAndSave() {
    if (!file || !session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error("Failed to analyze image");
      }

      const data: MacroResult = await res.json();

      setResult(data);

      await supabase.from("meals").insert({
        user_id: session.user.id,
        meal_time: new Date().toISOString(),
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
      });

      loadMeals();
    } catch (e: any) {
      setError(e.message);
    }

    setLoading(false);
  }

  if (!session) {
    return (
      <div style={containerStyle}>
        <h1>MacroCam</h1>

        <input
          style={inputStyle}
          placeholder="Email"
          defaultValue=""
          onChange={(e) => setEmail(e.target.value || "")}
        />

        <input
          style={inputStyle}
          type="password"
          placeholder="Password"
          defaultValue=""
          onChange={(e) => setPw(e.target.value || "")}
        />

        <button
          style={{
            ...buttonStyle,
            backgroundColor: !email || !pw ? "#555" : "#2563eb",
          }}
          onClick={signUpOrIn}
          disabled={!email || !pw}
        >
          Continue
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1>MacroCam</h1>

      <input
        style={inputStyle}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
          }
        }}
      />

      <button
        style={{
          ...buttonStyle,
          backgroundColor: !file ? "#555" : "#16a34a",
        }}
        onClick={analyzeAndSave}
        disabled={!file || loading}
      >
        {loading ? "Analyzing..." : "Analyze & Save"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={cardStyle}>
          <h3>Last Meal</h3>

          <p>Calories: {result.calories}</p>

          <p>Protein: {result.protein_g} g</p>

          <p>Carbs: {result.carbs_g} g</p>

          <p>Fat: {result.fat_g} g</p>
        </div>
      )}

      <div style={cardStyle}>
        <h3>Today Totals</h3>

        <p>Calories: {totals.calories}</p>

        <p>Protein: {totals.protein} g</p>

        <p>Carbs: {totals.carbs} g</p>

        <p>Fat: {totals.fat} g</p>
      </div>
    </div>
  );
}
