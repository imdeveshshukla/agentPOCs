import { describe, expect, it } from "bun:test";
import { resolveAccessiblePath } from "../src/tools/safe-fs.ts";

describe("resolveAccessiblePath", () => {
  it("allows paths inside the filesystem root", () => {
    const resolved = resolveAccessiblePath("C:/Windows/System32");
    expect(resolved.toLowerCase()).toContain("windows");
  });

  it("blocks paths outside the allowed root", () => {
    expect(() => resolveAccessiblePath("D:/outside")).toThrow(/Access denied/);
  });
});
