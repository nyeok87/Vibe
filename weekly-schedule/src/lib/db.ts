// 저장소: Supabase 환경변수가 있으면 Supabase(Postgres + 비공개 Storage), 없으면 로컬 .data 폴더(개발·시연용).
// 서버에서만 import 한다. service role 키는 브라우저로 나가지 않는다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

export type TableName = "departments" | "weeks" | "submissions" | "schedule_items" | "reports" | "settings";
type Row = Record<string, unknown>;
type Match = Record<string, unknown>;

export interface Store {
  select<T>(table: TableName, match?: Match): Promise<T[]>;
  insert(table: TableName, rows: Row[]): Promise<void>;
  update(table: TableName, match: Match, patch: Row): Promise<void>;
  remove(table: TableName, match: Match): Promise<void>;
  putFile(p: string, data: Uint8Array): Promise<void>;
  getFile(p: string): Promise<Uint8Array | null>;
  mode: "supabase" | "local";
}

const BUCKET = process.env.SUPABASE_BUCKET || "files";

// ---------- Supabase ----------
function supabaseStore(sb: SupabaseClient): Store {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apply = (q: any, match?: Match) => {
    for (const [k, v] of Object.entries(match ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
    return q;
  };
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(`DB 오류: ${error.message}`);
  };
  return {
    mode: "supabase",
    async select<T>(table: TableName, match?: Match) {
      const { data, error } = await apply(sb.from(table).select("*"), match);
      check(error);
      return (data ?? []) as T[];
    },
    async insert(table, rows) {
      if (!rows.length) return;
      const { error } = await sb.from(table).insert(rows);
      check(error);
    },
    async update(table, match, patch) {
      const { error } = await apply(sb.from(table).update(patch), match);
      check(error);
    },
    async remove(table, match) {
      const { error } = await apply(sb.from(table).delete(), match);
      check(error);
    },
    async putFile(p, data) {
      const { error } = await sb.storage.from(BUCKET).upload(p, data, { upsert: true, contentType: "application/octet-stream" });
      check(error);
    },
    async getFile(p) {
      const { data, error } = await sb.storage.from(BUCKET).download(p);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

// ---------- 로컬 JSON ----------
function localStore(): Store {
  const dir = path.join(process.cwd(), ".data");
  const dbFile = path.join(dir, "db.json");
  type Db = Record<TableName, Row[]>;
  const empty = (): Db => ({ departments: [], weeks: [], submissions: [], schedule_items: [], reports: [], settings: [] });
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<Db> {
    try {
      return { ...empty(), ...JSON.parse(await fs.readFile(dbFile, "utf8")) };
    } catch {
      return empty();
    }
  }
  async function write(db: Db) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = dbFile + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db));
    await fs.rename(tmp, dbFile);
  }
  // 쓰기는 한 줄로 세워 처리한다
  function mutate(fn: (db: Db) => void): Promise<void> {
    const run = queue.then(async () => {
      const db = await read();
      fn(db);
      await write(db);
    });
    queue = run.catch(() => undefined);
    return run;
  }
  const hit = (row: Row, match?: Match) => Object.entries(match ?? {}).every(([k, v]) => (row[k] ?? null) === v);
  const filePath = (p: string) => path.join(dir, "files", ...p.split("/"));

  return {
    mode: "local",
    async select<T>(table: TableName, match?: Match) {
      await queue;
      const db = await read();
      return structuredClone(db[table].filter((r) => hit(r, match))) as T[];
    },
    insert: (table, rows) => mutate((db) => void db[table].push(...structuredClone(rows))),
    update: (table, match, patch) =>
      mutate((db) => {
        db[table] = db[table].map((r) => (hit(r, match) ? { ...r, ...structuredClone(patch) } : r));
      }),
    remove: (table, match) =>
      mutate((db) => {
        db[table] = db[table].filter((r) => !hit(r, match));
      }),
    async putFile(p, data) {
      const f = filePath(p);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, data);
    },
    async getFile(p) {
      try {
        return new Uint8Array(await fs.readFile(filePath(p)));
      } catch {
        return null;
      }
    },
  };
}

let store: Store | null = null;

export function db(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = supabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else {
    if (process.env.VERCEL) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정해 주세요.");
    store = localStore();
  }
  return store;
}
