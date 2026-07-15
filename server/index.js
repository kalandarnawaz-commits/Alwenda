import express from "express";
import cors from "cors";
import { requireUser, isSupabaseConfigured } from "./auth.js";
import { runAlwen } from "./alwenAgent.js";

const PORT = Number(process.env.PORT) || 8787;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAlwenConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    alwenConfigured: isAlwenConfigured()
  });
});

app.post("/api/alwen/chat", requireUser, async (req, res) => {
  if (!isAlwenConfigured()) {
    return res.status(503).json({ error: "Alwen is not configured on the server yet (missing OPENAI_API_KEY)." });
  }

  const { message, city, language } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "A message is required." });
  }

  try {
    const output = await runAlwen(message, {
      userId: req.user.id,
      city: city || "Vilnius",
      language: language || "en"
    });
    res.json({ output });
  } catch (error) {
    console.error("[alwen] chat error:", error);
    res.status(500).json({ error: "Alwen could not complete this request." });
  }
});

app.listen(PORT, () => {
  console.log(`Alwenda server listening on http://localhost:${PORT}`);
  console.log(`  Supabase configured: ${isSupabaseConfigured()}`);
  console.log(`  Alwen (OpenAI) configured: ${isAlwenConfigured()}`);
});
