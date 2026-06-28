# 🤖 Local Agent — Intelligent CLI Research Assistant

An agentic CLI that can search files, read content (including PDFs), and summarize findings according to your goals. Built with a multi-stage cognitive architecture for reliable, efficient task completion.

## Architecture

```
          Goal
            │
            ▼
      ┌─ Decomposer ─┐
      │  (goal → 1-5  │
      │   sub-goals)  │
      └───────┬───────┘
              │
     ┌────────┴──── per sub-goal ────┐
     │  1. Inner Monologue           │
     │  2. Planner (tool selection)  │
     │  3. Action Verifier           │
     │  4. Tool Execution            │
     │  5. Observation Parser        │
     │  6. World Model Update        │
     │  7. Reflector / Self-Critic   │
     │  8. Sub-Goal Evaluator        │
     │  9. Continue / Next / Done    │
     └──────────────────────────────-┘
              │
              ▼
        Synthesizer → Final Answer
```

Each stage uses an LLM call (except the Verifier, which is deterministic). The agent reasons about what it knows, plans an action, validates it, executes it, extracts facts, self-critiques, and evaluates progress — all per step.

## Quick Start

```bash
# Install dependencies
bun install

# Make sure Ollama is running with a model
ollama pull qwen3:4b

# Interactive mode (prompts for workspace directory)
bun run dev interactive

# Research mode with a specific directory
bun run dev research "find all PDF files and summarize them" --dir "C:\Users\you\Desktop"

# Direct mode
bun run dev find all typescript files --dir ./src
```

## Usage

### Commands

| Command | Description |
|:--------|:------------|
| `bun run dev interactive` | Start an interactive session with the agent |
| `bun run dev research "<goal>"` | Run a one-shot research goal |
| `bun run dev <goal>` | Direct mode (shortcut for research) |

### Flags

| Flag | Description |
|:-----|:------------|
| `-d, --dir <path>` | Target directory to operate on (default: current directory) |
| `-m, --max-steps <n>` | Maximum loop iterations (default: 15) |
| `-q, --quiet` | Suppress per-step logs |

### Examples

```bash
# Search your Desktop for a resume
bun run dev interactive --dir "C:\Users\deves\Desktop"
agent> find my latest resume (devesh shukla)

# Find and summarize test files in a project
bun run dev research "find all test files and explain what they test" --dir ./

# Search file contents for a keyword
bun run dev research "find all files mentioning 'database'" --dir ./src
```

## Tools

The agent has 6 built-in tools:

| Tool | Purpose |
|:-----|:--------|
| **searchFiles** | Find files by name pattern across the workspace |
| **grepFiles** | Search **inside** file contents for text (replaces shell grep/findstr) |
| **readFile** | Read file contents — auto-extracts text from PDFs, detects binary files |
| **listDir** | List files and folders in a directory |
| **runCommand** | Run read-only shell commands (hardened — blocks scripts and escapes) |
| **saveNote** | Save findings as markdown notes |

### Adding Custom Tools

Create a new file in `src/tools/` implementing the `Tool` interface:

```typescript
import type { Tool } from "../agent/types.ts";

export const myTool: Tool = {
  name: "myTool",
  description: "What this tool does",
  parameters: [
    {
      name: "input",
      type: "string",
      description: "What this parameter is for",
      required: true,
    },
  ],
  async execute(params: Record<string, unknown>) {
    const input = String(params.input ?? "");
    // ... your logic
    return { success: true, data: "result string" };
  },
};
```

Then register it in `src/cli/index.ts`:

```typescript
import { myTool } from "../tools/my-tool.ts";

const tools = [searchFilesTool, grepFilesTool, readFileTool, listDirTool, runCommandTool, saveNoteTool, myTool];
```

## Project Structure

```
src/
├── cli/
│   └── index.ts            # CLI entry point (commander)
├── agent/
│   ├── runtime.ts           # Main agent loop (9-stage pipeline)
│   ├── loop.ts              # Public API facade
│   ├── types.ts             # Type system (Tool, AgentState, WorldModel, Plan)
│   ├── decomposer.ts        # Goal → sub-goals
│   ├── monologue.ts         # Pre-planning reasoning
│   ├── planner.ts           # Tool selection
│   ├── verifier.ts          # Deterministic action validation
│   ├── observer.ts          # Fact extraction from tool output
│   ├── reflector.ts         # Self-critique + strategy pivots
│   ├── evaluator.ts         # Sub-goal completion check
│   └── synthesizer.ts       # Final answer assembly
├── tools/
│   ├── search-files.ts      # File name search (fast-glob)
│   ├── grep-files.ts        # File content search
│   ├── read-file.ts         # Smart reader (PDF text extraction)
│   ├── list-dir.ts          # Directory listing
│   ├── run-command.ts       # Shell commands (hardened)
│   ├── saveNote.ts          # Markdown note saving
│   └── safe-fs.ts           # Path resolution + access control
├── llm/
│   └── ollama.ts            # LLM wrapper (chat, askJSON with Zod)
├── memory/
│   ├── db.ts                # SQLite setup
│   └── memory.ts            # Tiered memory (facts, trajectories)
├── workspace.ts             # Configurable workspace root
└── sandbox.ts               # Temp file sandbox + cleanup
```

## Security Model

The agent has multiple layers of protection:

| Layer | What It Does |
|:------|:-------------|
| **Tool Set** | `writeFile` excluded — agent cannot create arbitrary files |
| **Planner Rules** | LLM instructed to prefer built-in tools, never script, never escape |
| **Verifier** | Deterministically blocks `cd ..`, `../`, `python`, `node`, `bun` in commands |
| **runCommand** | Double-blocks destructive commands + script execution + path traversal |
| **Sandbox** | Any temp files go to `.agent-tmp/<session>/`, auto-deleted after each run |

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **LLM:** [Ollama](https://ollama.ai) (default model: `qwen3:4b`)
- **Structured Output:** [Zod](https://zod.dev) schema validation
- **File Search:** [fast-glob](https://github.com/mrmlnc/fast-glob)
- **PDF Parsing:** [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- **Memory:** SQLite via Bun's built-in `bun:sqlite`
- **CLI:** [Commander.js](https://github.com/tj/commander.js)

## Development

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Run both
bunx tsc --noEmit && bun test
```

## Configuration

The LLM model is configured in `src/llm/ollama.ts`. Change the model name to use a different Ollama model:

```typescript
model: "qwen3:4b"  // Change to any model you have pulled
```

## License

MIT