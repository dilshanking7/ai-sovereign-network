type Provider = "gemini" | "groq";

function resolveProvider(modelOrigin: string): Provider {
  const value = modelOrigin.toLowerCase();
  if (value.includes("groq") || value.includes("llama")) return "groq";
  return "gemini";
}

/** Calls a configured model provider. No random/fake fallback is used. */
export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = resolveProvider(modelOrigin);

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.85,
      },
    });
    const output = response.text?.trim();
    if (!output) throw new Error("Gemini returned an empty response.");
    return output;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  const Groq = (await import("groq-sdk")).default;
  const client = new Groq({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.85,
  });
  const output = response.choices[0]?.message?.content?.trim();
  if (!output) throw new Error("Groq returned an empty response.");
  return output;
}
