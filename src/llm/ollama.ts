import Groq from "groq-sdk";
import type { ZodType } from "zod";

// ── Message Types ───────────────────────────────────────────────────

export interface Message {
	role: "system" | "user" | "assistant";
	content: string;
}

// ── Client ──────────────────────────────────────────────────────────

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// ── Simple Ask (backward compatible) ────────────────────────────────

export async function ask(prompt: string): Promise<string> {
	return chat([{ role: "user", content: prompt }]);
}

// ── Chat with message history ───────────────────────────────────────

export async function chat(messages: Message[], model?: string): Promise<string> {
	const response = await groq.chat.completions.create({
		model: model ?? DEFAULT_MODEL,
		messages,
	});

	return response.choices[0]?.message?.content ?? "";
}

// ── Structured JSON output with Zod validation ──────────────────────

function extractJson(text: string): string {
	// Try to find a JSON code block first
	const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (codeBlockMatch) {
		return codeBlockMatch[1]!.trim();
	}

	// Fall back to finding raw JSON
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");

	if (start !== -1 && end > start) {
		return text.slice(start, end + 1);
	}

	// Try array
	const arrStart = text.indexOf("[");
	const arrEnd = text.lastIndexOf("]");

	if (arrStart !== -1 && arrEnd > arrStart) {
		return text.slice(arrStart, arrEnd + 1);
	}

	throw new Error(`No JSON found in LLM response: ${text.slice(0, 200)}`);
}

export async function askJSON<T>(
	messages: Message[],
	schema: ZodType<T>,
	retries = 2,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const raw = await chat(messages);
			const jsonStr = extractJson(raw);
			const parsed = JSON.parse(jsonStr);
			return schema.parse(parsed);
		} catch (error) {
			lastError = error;

			if (attempt < retries) {
				// Add a corrective message and retry
				messages = [
					...messages,
					{
						role: "user",
						content: `Your previous response was not valid JSON or did not match the required schema. Error: ${(error as Error).message}. Please try again with strictly valid JSON.`,
					},
				];
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}