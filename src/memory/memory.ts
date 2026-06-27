import { db } from "./db.ts";

// ── Types ───────────────────────────────────────────────────────────

interface MemoryRow {
	id: number;
	key: string;
	value: string;
	category: string;
	created_at: string;
}

// ── Ensure schema ───────────────────────────────────────────────────

db.exec(`
	CREATE TABLE IF NOT EXISTS memories_v2 (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT 'general',
		created_at TEXT NOT NULL
	);
`);

// ── Statements ──────────────────────────────────────────────────────

const insertStmt = db.prepare(
	"INSERT INTO memories_v2 (key, value, category, created_at) VALUES (?, ?, ?, ?)",
);

// ── Save ────────────────────────────────────────────────────────────

export function saveMemory(key: string, value: string, category = "general"): void {
	insertStmt.run(key, value, category, new Date().toISOString());
}

// ── Retrieve (latest N, optionally filtered by category) ────────────

export function getLatestMemories(key: string, limit = 8, category?: string): MemoryRow[] {
	if (category) {
		return db
			.query(
				"SELECT id, key, value, category, created_at FROM memories_v2 WHERE key = ? AND category = ? ORDER BY id DESC LIMIT ?",
			)
			.all(key, category, limit) as MemoryRow[];
	}

	return db
		.query(
			"SELECT id, key, value, category, created_at FROM memories_v2 WHERE key = ? ORDER BY id DESC LIMIT ?",
		)
		.all(key, limit) as MemoryRow[];
}

// ── Search by keyword ───────────────────────────────────────────────

export function searchMemories(key: string, keyword: string, limit = 10): MemoryRow[] {
	return db
		.query(
			"SELECT id, key, value, category, created_at FROM memories_v2 WHERE key = ? AND value LIKE ? ORDER BY id DESC LIMIT ?",
		)
		.all(key, `%${keyword}%`, limit) as MemoryRow[];
}

// ── Save a successful trajectory for future retrieval ───────────────

export function saveTrajectory(key: string, goal: string, steps: string, outcome: string): void {
	const value = JSON.stringify({ goal, steps, outcome });
	saveMemory(key, value, "trajectory");
}

// ── Get past successful trajectories for similar goals ──────────────

export function getSimilarTrajectories(key: string, limit = 3): MemoryRow[] {
	return getLatestMemories(key, limit, "trajectory");
}
