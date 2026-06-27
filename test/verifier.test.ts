import { describe, expect, it } from "bun:test";
import { verifyAction } from "../src/agent/verifier.ts";
import type { Tool, TraceEntry } from "../src/agent/types.ts";

const mockTools: Tool[] = [
	{
		name: "searchFiles",
		description: "Search for files",
		parameters: [{ name: "keyword", type: "string", description: "Search keyword", required: true }],
		execute: async () => ({ success: true, data: "[]" }),
	},
	{
		name: "readFile",
		description: "Read a file",
		parameters: [{ name: "path", type: "string", description: "File path", required: true }],
		execute: async () => ({ success: true, data: "content" }),
	},
];

describe("verifyAction", () => {
	it("accepts a valid action with correct params", () => {
		const result = verifyAction(
			{ tool: "searchFiles", params: { keyword: "test" }, reasoning: "finding test files" },
			mockTools,
			[],
		);
		expect(result.valid).toBe(true);
	});

	it("rejects an action with unknown tool", () => {
		const result = verifyAction(
			{ tool: "fakeToolXYZ", params: {}, reasoning: "test" },
			mockTools,
			[],
		);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("does not exist");
	});

	it("rejects an action missing required parameters", () => {
		const result = verifyAction(
			{ tool: "searchFiles", params: {}, reasoning: "test" },
			mockTools,
			[],
		);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Missing required parameter");
	});

	it("accepts the 'none' tool", () => {
		const result = verifyAction(
			{ tool: "none", params: {}, reasoning: "direct answer" },
			mockTools,
			[],
		);
		expect(result.valid).toBe(true);
	});

	it("detects repeated identical actions", () => {
		const history: TraceEntry[] = [
			{ step: 1, stage: "act", message: 'searchFiles:{"keyword":"test"}', timestamp: "" },
			{ step: 2, stage: "act", message: 'searchFiles:{"keyword":"test"}', timestamp: "" },
		];

		const result = verifyAction(
			{ tool: "searchFiles", params: { keyword: "test" }, reasoning: "test" },
			mockTools,
			history,
		);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("repeated");
	});
});
