import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { prompt, model, config, userApiKey } = body || {};
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key Gemini tidak ditemukan. Harap masukkan API Key di menu Identitas Guru atau tambahkan GEMINI_API_KEY di Environment Variables Vercel.',
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

    let targetModel = model || 'gemini-3.8-flash';
    if (targetModel === 'gemini-3.5-flash' || targetModel === 'gemini-2.5-flash' || targetModel === 'gemini-3.6-flash') {
      targetModel = 'gemini-3.8-flash';
    }

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: config || {},
    });

    return res.status(200).json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Gemini API Error in Vercel function:', error);
    let status = 500;
    let message = error.message || 'Gagal merumuskan dokumen dengan Gemini AI';

    try {
      if (typeof message === 'string' && message.includes('{')) {
        const match = message.match(/"message"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          message = match[1];
        }
      }
    } catch {}

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      status = 401;
      message = 'API Key Gemini tidak valid. Silakan periksa kembali API Key Anda di Identitas Guru atau Vercel.';
    } else if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
      status = 429;
      message = 'Kuota Gemini API telah tercapai (Rate Limit / Quota Exceeded). Silakan coba lagi nanti atau ganti API Key.';
    } else if (message.includes('high demand') || message.includes('UNAVAILABLE') || message.includes('503')) {
      status = 503;
      message = 'Server Gemini saat ini sedang sibuk (high demand). Silakan klik tombol perumusan kembali beberapa saat lagi.';
    }

    return res.status(status).json({ error: message });
  }
}
