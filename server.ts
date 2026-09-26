import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-side Gemini API proxy
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, model, config, userApiKey } = req.body;
      const apiKey = userApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ 
          error: "API Key Gemini tidak ditemukan. Harap isi API Key di Identitas Guru atau tambahkan GEMINI_API_KEY di pengaturan server / Vercel." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      
      // Determine model: fallback to gemini-3.8-flash if invalid model passed
      let targetModel = model || "gemini-3.8-flash";
      if (targetModel === "gemini-3.5-flash" || targetModel === "gemini-2.5-flash" || targetModel === "gemini-3.6-flash") {
        targetModel = "gemini-3.8-flash";
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: config || {},
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("Gemini API Error in server:", error);
      let status = 500;
      let message = error.message || "Gagal merumuskan dokumen dengan Gemini AI";

      try {
        if (typeof message === "string" && message.includes("{")) {
          const match = message.match(/"message"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            message = match[1];
          }
        }
      } catch {}

      if (message.includes("API_KEY_INVALID") || message.includes("API key not valid")) {
        status = 401;
        message = "API Key Gemini tidak valid. Silakan periksa kembali API Key Anda di Identitas Guru.";
      } else if (message.includes("RESOURCE_EXHAUSTED") || message.includes("quota") || message.includes("429")) {
        status = 429;
        message = "Kuota Gemini API telah tercapai (Rate Limit / Quota Exceeded). Silakan coba lagi nanti atau gunakan API Key lain.";
      } else if (message.includes("high demand") || message.includes("UNAVAILABLE") || message.includes("503")) {
        status = 503;
        message = "Server Gemini saat ini sedang sibuk (high demand). Silakan klik 'Rumuskan' kembali beberapa saat lagi.";
      }

      res.status(status).json({ error: message });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
