import { describe, expect, it } from "bun:test";
import { searchFilesTool } from "../src/tools/search-files.ts";
import { listDirTool } from "../src/tools/list-dir.ts";

describe("searchFilesTool (typed)", () => {
	it("returns ToolResult with success=true for valid search", async () => {
		const result = await searchFilesTool.execute({ keyword: "ts" });
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
