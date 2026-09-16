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
          error: "API Key Gemini tidak ditemukan. Harap isi API Key di Identitas Guru atau hubungi admin." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Determine model: fallback to gemini-3.6-flash if invalid model passed
      let targetModel = model || "gemini-3.6-flash";
      if (targetModel === "gemini-3.5-flash" || targetModel === "gemini-2.5-flash") {
        targetModel = "gemini-3.6-flash";
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: config || {},
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("Gemini API Error in server:", error);
      res.status(500).json({ 
        error: error.message || "Gagal merumuskan dokumen dengan Gemini AI" 
      });
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
