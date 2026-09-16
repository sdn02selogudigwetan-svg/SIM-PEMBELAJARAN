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
  const response = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: options.prompt,
      userApiKey: options.userApiKey,
      model: options.model || 'gemini-3.6-flash',
      config: options.config,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Gagal menghubungi server Gemini' }));
    throw new Error(errorData.error || `Server error (${response.status})`);
  }

  const data = await response.json();
  return data.text || '';
}
