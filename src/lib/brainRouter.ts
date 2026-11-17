import Groq from 'groq-sdk';

const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY1,
].filter((k): k is string => Boolean(k && k.trim()));

// Yeh models ki list hai, agar ek model error dega toh code apne aap doosre par switch ho jayega
const AVAILABLE_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
];

export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const shuffledKeys = [...groqKeys].sort(() => Math.random() - 0.5);
  let lastError: any = null;

  if (shuffledKeys.length === 0) {
    throw new Error('No valid Groq API keys configured.');
  }

  for (const key of shuffledKeys) {
    for (const model of AVAILABLE_MODELS) {
      try {
        const groqClient = new Groq({ apiKey: key });
        const completion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: model,
          response_format: { type: 'json_object' },
        });
        return completion.choices[0]?.message?.content || '{}';
      } catch (err: any) {
        lastError = err;
        // Agar model not found ya decommissioned hai, toh agli loop mein next model try karega
        continue;
      }
    }
  }

  throw lastError || new Error('All Groq API keys and fallback models failed.');
}
