import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY1,
].filter((k): k is string => Boolean(k && k.trim()));

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (modelOrigin.toLowerCase().includes('gemini')) {
    const response = await gemini.models.generateContent({
      model: 'gemini-3.8-flash', // yahan model update kar diya gaya hai
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: { responseMimeType: 'application/json' },
    });
    return response.text || '{}';
  } else {
    const shuffledKeys = [...groqKeys].sort(() => Math.random() - 0.5);
    let lastError: any = null;

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
        continue;
      }
    }
    throw lastError || new Error('No valid Groq API key configured');
  }
}
