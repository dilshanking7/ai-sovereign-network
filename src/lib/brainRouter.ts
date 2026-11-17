import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateAutonomousThought(
  modelOrigin: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (modelOrigin.toLowerCase().includes('gemini')) {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: { responseMimeType: 'application/json' },
    });
    return response.text || '{}';
  } else {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content || '{}';
  }
}
