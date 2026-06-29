import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

const MAX_CHARS = 8000;

// Text file extensions that should be read as UTF-8
const TEXT_EXTENSIONS = new Set([
	".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".css", ".html", ".xml",
	".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".env", ".sh", ".bat", ".cmd",
	".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".cs",
	".sql", ".graphql", ".csv", ".tsv", ".log", ".gitignore", ".editorconfig",
	".dockerfile", ".makefile", ".gradle", ".properties", ".svg",
]);

// Binary extensions we should just report metadata for (not dump contents)
const BINARY_EXTENSIONS = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff",
	".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".flac",
	".zip", ".tar", ".gz", ".rar", ".7z",
	".exe", ".dll", ".so", ".dylib", ".bin",
	".doc", ".xls", ".ppt",  // Old Office formats (binary)
	".class", ".o", ".obj",
]);

function getExtension(filePath: string): string {
	return path.extname(filePath).toLowerCase();
}

async function readPdf(fullPath: string): Promise<string> {
	try {
		const { PDFParse } = await import("pdf-parse");
		const buffer = await fs.readFile(fullPath);
		const parser = new PDFParse({ data: new Uint8Array(buffer) });
		const result = await parser.getText();

		const text = result.text?.trim();
		const numpages = result.total ?? "?";

		if (!text) {
			return `[PDF has ${numpages} page(s) but no extractable text — may be scanned/image-based]`;
		}

		if (text.length > MAX_CHARS) {
			return `${text.slice(0, MAX_CHARS)}\n\n[PDF text truncated to ${MAX_CHARS} chars. Total: ${text.length} chars, ${numpages} page(s)]`;
		}

		return `${text}\n\n[${numpages} page(s), ${text.length} chars]`;
	} catch (error) {
		return `Failed to parse PDF: ${(error as Error).message}`;
	}
}

export const readFileTool: Tool = {
	name: "readFile",
	description: "Read a file within the workspace. Automatically extracts text from PDFs. Returns file contents for text files and metadata for binary files.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Path to the file (relative to workspace root, or absolute)",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const rawPath = String(params.path ?? "").trim();

		if (!rawPath) {
			return { success: false, data: "readFile requires a non-empty file path" };
		}

		const workspace = getWorkspace();
		const fullPath = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(workspace, rawPath);
		const ext = getExtension(fullPath);

		try {
			// Check file exists and get stats
			const stats = await fs.stat(fullPath);

			// PDF — extract text
			if (ext === ".pdf") {
				const text = await readPdf(fullPath);
				return {
					success: true,
					data: text,
					metadata: { path: rawPath, fullPath, type: "pdf", sizeBytes: stats.size },
				};
			}

			// Known binary — return metadata only
			if (BINARY_EXTENSIONS.has(ext)) {
				return {
					success: true,
					data: `[Binary file: ${path.basename(fullPath)}, ${(stats.size / 1024).toFixed(1)} KB, type: ${ext}]`,
					metadata: { path: rawPath, fullPath, type: "binary", ext, sizeBytes: stats.size },
				};
			}

			// DOCX — basic extraction attempt
			if (ext === ".docx") {
				try {
					// Read as zip and extract document.xml text (basic approach)
					const content = await fs.readFile(fullPath);
					// Check if it's actually a zip (DOCX is a zip)
					if (content[0] === 0x50 && content[1] === 0x4b) {
						return {
							success: true,
							data: `[DOCX file: ${path.basename(fullPath)}, ${(stats.size / 1024).toFixed(1)} KB. Use runCommand with a tool to extract DOCX text if needed.]`,
							metadata: { path: rawPath, fullPath, type: "docx", sizeBytes: stats.size },
						};
					}
				} catch {
					// Fall through to text read
				}
			}

			// Text file — read as UTF-8
			const content = await fs.readFile(fullPath, "utf8");

			// Check if it's actually binary (contains null bytes)
			if (content.includes("\0")) {
				return {
					success: true,
					data: `[Binary file: ${path.basename(fullPath)}, ${(stats.size / 1024).toFixed(1)} KB]`,
					metadata: { path: rawPath, fullPath, type: "binary", sizeBytes: stats.size },
				};
			}

			if (content.length <= MAX_CHARS) {
				return {
					success: true,
					data: content,
					metadata: { path: rawPath, fullPath, type: "text", chars: content.length },
				};
			}

			return {
				success: true,
				data: `${content.slice(0, MAX_CHARS)}\n\n[truncated to ${MAX_CHARS} chars]`,
				metadata: { path: rawPath, fullPath, type: "text", chars: content.length, truncated: true },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to read file: ${fullPath}. ${(error as Error).message}`,
			};
		}
	},
};
