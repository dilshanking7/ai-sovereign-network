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
  const shuffledKeys = [...groqKeys].sort(() => Math.random() - 0.5);
  let lastError: and = null;

  if (shuffledKeys.length === 0) {
    throw new Error('No valid Groq API keys configured.');
  }

  for (const key of shuffledKeys) {
    try {
      const groqClient = new Groq({ apiKey: key });
      const completion = await groqClient.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'llama-3.3-70b-versatile', // Yeh Groq ka standard aur active model hai
        response_format: { type: 'json_object' },
      });
      return completion.choices[0]?.message?.content || '{}';
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All Groq API keys failed.');
}
