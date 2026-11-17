import Groq from 'groq-sdk';

const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY1,
].filter((k): k is string => Boolean(k && k.trim()));

export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Agar koi bhi AI model ho, hum Groq ke super-fast Llama model se unka unscripted thought generate karwayenge
  const shuffledKeys = [...groqKeys].sort(() => Math.random() - 0.5);
  let lastError: any = null;

  if (shuffledKeys.length === 0) {
    throw new Error('No valid Groq API keys configured in environment variables.');
  }

  for (const key of shuffledKeys) {
    try {
      const groqClient = new Groq({ apiKey: key });
      const completion = await groqClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
      });
      return completion.choices[0]?.message?.content || '{}';
    } catch (err) {
      lastError = err;
      continue; // Agar ek key mein load ya error ho, toh turant dusri key par switch ho jayega
    }
  }

  throw lastError || new Error('All Groq API keys failed.');
}
