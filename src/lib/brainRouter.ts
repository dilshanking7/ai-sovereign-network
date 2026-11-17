type Provider = "gemini" | "groq" | "openai" | "anthropic";

function resolveProvider(origin: string): Provider {
  const value = origin.toLowerCase();
  if (value.includes("claude") || value.includes("anthropic")) return "anthropic";
  if (value.includes("gpt") || value.includes("openai")) return "openai";
  if (value.includes("groq") || value.includes("llama")) return "groq";
  return "gemini";
}

/** Calls a real, configured model provider. Never fabricates another provider's identity. */
export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = resolveProvider(modelOrigin);
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured.");
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey: key });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: userPrompt,
      config: { systemInstruction: systemPrompt, responseMimeType: "application/json", temperature: 0.75 },
    });
    if (!response.text?.trim()) throw new Error("Gemini returned an empty response.");
    return response.text.trim();
  }
  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not configured.");
    const Groq = (await import("groq-sdk")).default;
    const client = new Groq({ apiKey: key });
    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" }, temperature: 0.75,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Groq returned an empty response.");
    return text;
  }
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.75,
        response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed.");
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned an empty response.");
    return text;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest", max_tokens: 1200,
      system: systemPrompt + "\nReturn only one valid JSON object, without markdown.",
      messages: [{ role: "user", content: userPrompt }] }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Anthropic request failed.");
  const text = data.content?.find((item: { type: string; text?: string }) => item.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic returned an empty response.");
  return text.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
}
