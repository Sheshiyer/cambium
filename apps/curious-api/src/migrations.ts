export interface MigrationFile {
  name: string;
  sql: string;
}

export function sqlStatements(source: string): string[] {
  const sql = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements: string[] = [];
  let depth = 0;
  let last = 0;
  const marker = /\bBEGIN\b|\bEND\b|;/gi;
  for (const match of sql.matchAll(marker)) {
    const word = match[0].toUpperCase();
    if (word === "BEGIN") depth += 1;
    else if (word === "END") depth = Math.max(0, depth - 1);
    else if (depth === 0 && match.index !== undefined) {
      const statement = sql.slice(last, match.index).trim();
      if (statement) statements.push(statement);
      last = match.index + match[0].length;
    }
  }
  const tail = sql.slice(last).trim();
  if (tail) statements.push(tail);
  return statements;
}

export async function applyMigrations(exec: (sql: string) => Promise<void>, files: MigrationFile[]): Promise<string[]> {
  const ordered = [...files].sort((left, right) => left.name.localeCompare(right.name));
  for (const file of ordered) {
    const statements = sqlStatements(file.sql);
    if (!file.name.endsWith(".sql") || statements.length === 0) throw new Error(`migration ${file.name} is empty`);
    for (const statement of statements) await exec(statement.replace(/\s+/g, " ").trim());
  }
  return ordered.map((file) => file.name);
}
