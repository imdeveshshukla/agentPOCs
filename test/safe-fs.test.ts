import { describe, expect, it, beforeEach } from "bun:test";
import { resolveAccessiblePath } from "../src/tools/safe-fs.ts";
import { setWorkspace } from "../src/workspace.ts";

describe("resolveAccessiblePath", () => {
	beforeEach(() => {
		// Reset workspace to current directory for each test
		setWorkspace(process.cwd());
	});

	it("allows relative paths inside the workspace", () => {
		const resolved = resolveAccessiblePath("src/agent/types.ts");
		expect(resolved).toContain("src");
	});

	it("allows absolute paths within the filesystem root", () => {
		const resolved = resolveAccessiblePath("C:/Windows/System32");
		expect(resolved.toLowerCase()).toContain("windows");
	});

	it("uses custom workspace when set", () => {
		setWorkspace("C:/Users/deves/Desktop");
		const resolved = resolveAccessiblePath(".");
		expect(resolved).toContain("Desktop");
	});
});
