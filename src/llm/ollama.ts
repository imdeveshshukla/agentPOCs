import Groq from "groq-sdk";
import ollama from "ollama";

// export async function ask(prompt: string): Promise<string> {
//   const response = await ollama.chat({
//     model: process.env.OLLAMA_MODEL ?? "qwen3:4b",
//     messages: [
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//   });

//   return response.message.content;
// }

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function ask(prompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}