import { describe, expect, it } from "bun:test";
import { evaluateGoalHeuristic } from "../src/agent/evaluator.ts";

describe("evaluateGoalHeuristic", () => {
  it("marks file creation as complete when the tool reports success", () => {
    const result = evaluateGoalHeuristic("create a file named test.txt and add hello", {
      history: ["step 1 -> writeFile: Wrote file: test.txt"],
      lastResult: "Wrote file: test.txt",
      steps: 1,
      memories: [],
    });

    expect(result).toEqual({
      completed: true,
      reason: "The requested file operation completed successfully.",
    });
  });
});
