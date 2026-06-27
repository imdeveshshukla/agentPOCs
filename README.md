I'd structure it as a real project, not a tutorial project. The goal is that after 2-3 weeks you can keep extending it without rewriting everything.

Create Project
bun create

or

mkdir local-agent
cd local-agent

bun init -y

Install dependencies:

bun add ollama commander zod better-sqlite3 chalk

bun add -d typescript @types/bun

Later:

bun add fast-glob
bun add pdf-parse
bun add cheerio
Project Structure
local-agent/

├── src
│
├── cli
│   └── index.ts
│
├── agent
│   ├── loop.ts
│   ├── planner.ts
│   ├── evaluator.ts
│   └── types.ts
│
├── tools
│   ├── search-files.ts
│   ├── read-file.ts
│   ├── save-note.ts
│   ├── web-search.ts
│   └── run-command.ts
│
├── llm
│   └── ollama.ts
│
├── memory
│   ├── db.ts
│   └── memory.ts
│
├── notes
│
├── data
│   └── agent.db
│
├── package.json
├── tsconfig.json
└── bunfig.toml
Core Types

src/agent/types.ts

export interface Tool {
  name: string;
  description: string;

  execute(input: string): Promise<string>;
}

export interface AgentState {
  goal: string;
  steps: number;
  history: string[];
}
Ollama Wrapper

src/llm/ollama.ts

import ollama from "ollama";

export async function ask(prompt: string) {
  const response = await ollama.chat({
    model: "qwen3:4b",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return response.message.content;
}
First Tool

src/tools/search-files.ts

import fg from "fast-glob";

export const searchFiles = {
  name: "searchFiles",

  description: "Search files by keyword",

  async execute(input: string) {

    const files = await fg("**/*", {
      cwd: process.cwd()
    });

    const matches = files.filter(file =>
      file.toLowerCase().includes(
        input.toLowerCase()
      )
    );

    return JSON.stringify(
      matches.slice(0, 20),
      null,
      2
    );
  }
};
Planner

The planner only decides:

What tool?
What input?

src/agent/planner.ts

import { ask } from "../llm/ollama";

export async function planner(
  goal: string,
  availableTools: string[]
) {

  const prompt = `
Goal:
${goal}

Available tools:
${availableTools.join("\n")}

Return JSON:

{
 "tool":"tool-name",
 "input":"tool-input"
}
`;

  return ask(prompt);
}
Evaluator

src/agent/evaluator.ts

import { ask } from "../llm/ollama";

export async function evaluator(
  goal: string,
  result: string
) {

  const response = await ask(`
Goal:
${goal}

Result:
${result}

Is the goal completed?

Answer only YES or NO
`);

  return response.includes("YES");
}
Agent Loop

src/agent/loop.ts

import { planner } from "./planner";
import { evaluator } from "./evaluator";

export async function runAgent(
  goal: string,
  tools: any[]
) {

  let lastResult = "";

  for (let step = 0; step < 10; step++) {

    const action = await planner(
      goal,
      tools.map(t => t.name)
    );

    const parsed = JSON.parse(action);

    const tool = tools.find(
      t => t.name === parsed.tool
    );

    if (!tool) {
      throw new Error("Unknown tool");
    }

    lastResult = await tool.execute(
      parsed.input
    );

    const done = await evaluator(
      goal,
      lastResult
    );

    if (done) {
      return lastResult;
    }
  }

  return lastResult;
}
CLI

src/cli/index.ts

import { Command } from "commander";

import { runAgent } from "../agent/loop";

import { searchFiles } from "../tools/search-files";

const program = new Command();

program
  .command("research")
  .argument("<goal>")
  .action(async goal => {

    const result =
      await runAgent(goal, [
        searchFiles
      ]);

    console.log(result);
  });

program.parse();
package.json
{
  "scripts": {
    "dev": "bun src/cli/index.ts",
    "start": "bun run src/cli/index.ts"
  }
}
Run
bun run dev research "find azure files"
Next Features (in order)

After this works, add:

✓ searchFiles
✓ readFile
✓ saveNote

→ webSearch
→ sqlite memory
→ command execution
→ PDF reader
→ markdown notes
→ task history
→ retries
→ goal tracking

One architectural improvement I'd make immediately: instead of having the planner return free-form JSON, define tool schemas with Zod and force the model to produce structured actions. That will save you a lot of debugging once you add more than 3-4 tools.