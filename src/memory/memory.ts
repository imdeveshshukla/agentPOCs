import { db } from "./db.ts";

interface MemoryRow {
  id: number;
  key: string;
  value: string;
  created_at: string;
}

const insertStmt = db.prepare("INSERT INTO memories (key, value, created_at) VALUES (?, ?, ?)");

export function saveMemory(key: string, value: string): void {
  insertStmt.run(key, value, new Date().toISOString());
}

export function getLatestMemories(key: string, limit = 5): MemoryRow[] {
  return db
    .query("SELECT id, key, value, created_at FROM memories WHERE key = ? ORDER BY id DESC LIMIT ?")
    .all(key, limit) as MemoryRow[];
}
