export interface GenerateGeminiOptions {
  prompt: string;
  userApiKey?: string | null;
  model?: string;
  config?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export async function generateWithGemini(options: GenerateGeminiOptions): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt,
        userApiKey: options.userApiKey,
        model: options.model || 'gemini-3.8-flash',
        config: options.config,
      }),
    });
  } catch (netErr: any) {
    console.error('Fetch error connecting to /api/gemini/generate:', netErr);
    throw new Error('Gagal menghubungi server API. Pastikan jaringan internet Anda aktif.');
  }

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch {
      if (response.status === 404) {
        errorMessage = 'Endpoint /api/gemini/generate tidak ditemukan (404). Pastikan serverless function Vercel sudah ter-deploy.';
      } else {
        errorMessage = `Gagal menghubungi server Gemini (${response.status})`;
      }
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.text || '';
}
