import { describe, expect, it, beforeEach } from "bun:test";
import { searchFilesTool } from "../src/tools/search-files.ts";
import { listDirTool } from "../src/tools/list-dir.ts";
import { grepFilesTool } from "../src/tools/grep-files.ts";
import { runCommandTool } from "../src/tools/run-command.ts";
import { setWorkspace } from "../src/workspace.ts";

// Reset workspace to project root for each test
beforeEach(() => {
	setWorkspace(process.cwd());
});

describe("searchFilesTool (typed)", () => {
	it("returns ToolResult with success=true for valid search", async () => {
		const result = await searchFilesTool.execute({ keyword: "types.ts" });
		expect(result.success).toBe(true);
		expect(result.metadata?.matchCount).toBeGreaterThan(0);
	});

	it("returns success=false for empty keyword", async () => {
		const result = await searchFilesTool.execute({ keyword: "" });
		expect(result.success).toBe(false);
	});

	it("returns success=true with 0 matches for non-existent keyword", async () => {
		const result = await searchFilesTool.execute({ keyword: "nonexistentkeyword12345xyz" });
		expect(result.success).toBe(true);
		expect(result.metadata?.matchCount).toBe(0);
	});
});

describe("listDirTool (typed)", () => {
	it("lists the current directory", async () => {
		const result = await listDirTool.execute({ path: "." });
		expect(result.success).toBe(true);
		expect(result.data).toContain("src/");
	});

	it("returns error for non-existent directory", async () => {
		const result = await listDirTool.execute({ path: "nonexistentdir12345" });
		expect(result.success).toBe(false);
	});
});

describe("grepFilesTool", () => {
	it("finds text inside TypeScript files", async () => {
		const result = await grepFilesTool.execute({ pattern: "AgentState", filePattern: "**/*.ts" });
		expect(result.success).toBe(true);
		expect(result.metadata?.matchCount).toBeGreaterThan(0);
		expect(result.data).toContain("AgentState");
	});

	it("returns success=false for empty pattern", async () => {
		const result = await grepFilesTool.execute({ pattern: "" });
		expect(result.success).toBe(false);
	});

	it("returns 0 matches for non-existent pattern", async () => {
		// Use a pattern that won't match anything including this test file
		const unicodePattern = "\u2603\u2764\u2602\u2601\u2600";
		const result = await grepFilesTool.execute({ pattern: unicodePattern });
		expect(result.success).toBe(true);
		expect(result.metadata?.matchCount).toBe(0);
	});
});

describe("runCommandTool (hardened)", () => {
	it("blocks script execution", async () => {
		const result = await runCommandTool.execute({ command: "python script.py" });
		expect(result.success).toBe(false);
		expect(result.data).toContain("Blocked script execution");
	});

	it("blocks directory escape", async () => {
		const result = await runCommandTool.execute({ command: "cd .. && dir" });
		expect(result.success).toBe(false);
		expect(result.data).toContain("Blocked directory escape");
	});

	it("blocks path traversal", async () => {
		const result = await runCommandTool.execute({ command: "type ..\\..\\secret.txt" });
		expect(result.success).toBe(false);
		expect(result.data).toContain("Blocked path traversal");
	});

	it("allows safe commands", async () => {
		const result = await runCommandTool.execute({ command: "echo hello" });
		expect(result.success).toBe(true);
		expect(result.data).toContain("hello");
	});
});
