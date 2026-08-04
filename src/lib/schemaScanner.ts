import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

export interface TableRef {
  table: string
  file: string
  line: number
  context: string
  type: 'select' | 'insert' | 'update' | 'delete' | 'rpc' | 'column'
}

export interface ColumnRef {
  table: string
  column: string
  file: string
  line: number
}

export interface RpcRef {
  name: string
  file: string
  line: number
}

export interface MigrationObject {
  type: 'table' | 'column' | 'rls' | 'policy' | 'function' | 'rpc' | 'view'
  name: string
  table?: string
  file: string
}

export interface SchemaDiff {
  missingTables: string[]
  missingColumns: { table: string; column: string }[]
  missingRls: string[]
  missingPolicies: { table: string; policy: string }[]
  missingFunctions: string[]
  missingRpc: string[]
  references: TableRef[]
}

export interface FrontendScanResult {
  tables: Set<string>
  columns: Map<string, Set<string>>
  rpcs: Set<string>
  policies: Map<string, Set<string>>
  rawRefs: TableRef[]
}

const SRC_DIR = path.join(process.cwd(), 'src')
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')
const ROOT_SQL_DIR = process.cwd()

const SQL_FILES = [
  ...glob.sync('**/*.sql', { cwd: MIGRATIONS_DIR, absolute: false }).map(f => path.join(MIGRATIONS_DIR, f)),
  ...glob.sync('*.sql', { cwd: ROOT_SQL_DIR, absolute: false }).map(f => path.join(ROOT_SQL_DIR, f)),
]

const FRONTEND_SKIP = new Set([
  'react', 'sonner', 'zustand', 'framer', 'motion', 'lucide', 'clsx', 'tailwind',
  'recharts', 'react-router-dom', 'react-dom', 'next', 'vue', 'angular',
  'jquery', 'axios', 'lodash', 'underscore', 'moment', 'dayjs',
  'useauthstore', 'usecoinsstore', 'usexpstore', 'usenavstore',
  'fs', 'path', 'glob', 'uuid', 'leaflet', 'dompurify', 'jsbarcode', 'qrcode',
  'three', 'jspdf', 'audio', 'howler', 'key', 'table', 'view',
  'usestate', 'useeffect', 'usecontext', 'useref', 'usememo', 'usecallback',
  'usereducer', 'uselayouteffect', 'useimperativehandle', 'usenavigation',
  'useparams', 'uselocation', 'usesearchparams', 'usenavigate',
  'usetransition', 'usedeferredvalue', 'useid', 'usesync External store',
  'network_cors', 'network_error', 'web_push_subscriptions',
  'invited', 'profiles', 'messages', 'stream_chat',
])

const SQL_KEYWORDS = new Set([
  'select', 'insert', 'update', 'delete', 'from', 'where', 'join', 'order', 'group',
  'having', 'limit', 'offset', 'table', 'key', 'index', 'view', 'create', 'drop',
  'alter', 'add', 'column', 'constraint', 'foreign', 'primary', 'unique', 'check',
  'default', 'null', 'not', 'and', 'or', 'in', 'is', 'like', 'between', 'case',
  'when', 'then', 'else', 'end', 'as', 'on', 'set', 'into', 'values', 'returning',
  'exists', 'all', 'any', 'some', 'union', 'intersect', 'except', 'distinct',
  'into', 'over', 'partition', 'rows', 'range', 'unbounded', 'preceding', 'following',
  'current', 'row', 'grouping', 'sets', 'rollup', 'cube', 'lateral', 'cross',
  'natural', 'full', 'left', 'right', 'inner', 'outer', 'self', 'using', 'match',
  'simple', 'partial', 'exclusion', 'key', 'include', 'tablespace', 'using',
])

const supabasePatterns = [
  /\.from\(['"`]([a-z_][a-z0-9_]*)['"`]\)/gi,
  /\.fromTable\(['"`]([a-z_][a-z0-9_]*)['"`]\)/gi,
  /table:\s*['"`]([a-z_][a-z0-9_]*)['"`]/gi,
  /table\s+['"`]([a-z_][a-z0-9_]*)['"`]/gi,
  /from\s+['"`]([a-z_][a-z0-9_]*)['"`]/gi,
  /into\(['"`]([a-z_][a-z0-9_]*)['"`]\)/gi,
  /\.rpc\(['"`]([a-z_][a-z0-9_]*)['"`]\)/gi,
  /call\s+['"`]([a-z_][a-z0-9_]*)['"`]/gi,
]

function extractTableFromQuery(text: string): string | null {
  const patterns = [
    /INSERT\s+INTO\s+['"`]?([a-z_][a-z0-9_]*)['"`]?/i,
    /UPDATE\s+['"`]?([a-z_][a-z0-9_]*)['"`]?\s+SET/i,
    /DELETE\s+FROM\s+['"`]?([a-z_][a-z0-9_]*)['"`]?/i,
    /FROM\s+['"`]?([a-z_][a-z0-9_]*)['"`]?/i,
    /JOIN\s+['"`]?([a-z_][a-z0-9_]*)['"`]?/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].toLowerCase()
  }
  return null
}

export function scanTypeScriptFiles(): FrontendScanResult {
  const tables = new Set<string>()
  const columns = new Map<string, Set<string>>()
  const rpcs = new Set<string>()
  const policies = new Map<string, Set<string>>()
  const rawRefs: TableRef[] = []

  const files = glob.sync('**/*.{ts,tsx}', { cwd: SRC_DIR, absolute: false })

  for (const file of files) {
    const fullPath = path.join(SRC_DIR, file)
    let content: string
    try {
      content = fs.readFileSync(fullPath, 'utf-8')
    } catch {
      continue
    }

    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      if (/^\s*import\s+|require\s*\(|from\s+['"`]fs['"`]|from\s+['"`]path['"`]|from\s+['"`]glob['"`]/.test(line)) continue
      if (/\/\/|#|<!--/.test(line.trim())) continue

      for (const pattern of supabasePatterns) {
        const matches = line.matchAll(pattern)
        for (const m of matches) {
          const raw = m[1]
          if (!raw) continue
          const normalized = raw.toLowerCase().replace(/['"`]/g, '')

          if (['then', 'catch', 'true', 'false', 'null', 'undefined', 'data', 'error', 'count', 'select', 'insert', 'update', 'delete', 'from', 'table', 'view'].includes(normalized)) continue
          if (FRONTEND_SKIP.has(normalized)) continue
          if (SQL_KEYWORDS.has(normalized)) continue
          if (normalized.length < 3) continue
          if (!/^[a-z][a-z0-9_]*$/.test(normalized)) continue

          if (/^(check_|get_|set_|process_|grant_|auto_|verify_|create_|delete_|update_|find_|search_|fetch_|load_|refresh_|sync_|ensure_|run_|start_|stop_|payout_|notify_|end_|restore_|purchase_|is_|can_|has_|should_|will_|did_|do_|apply_|calculate_|cleanup_|disable_|mark_)/.test(normalized)) {
            if (!tables.has(normalized)) {
              rpcs.add(normalized)
              rawRefs.push({ table: normalized, file, line: lineNum, context: line.trim(), type: 'rpc' })
            }
            continue
          }

          tables.add(normalized)
          if (!columns.has(normalized)) columns.set(normalized, new Set())

          const colMatches = line.matchAll(/(?:\.|\[)['"`]?([a-z_][a-z0-9_]*)['"`]?(?=\s*[=:,)]|\s*$)/gi)
          for (const cm of colMatches) {
            const col = cm[1].toLowerCase()
            if (['then', 'catch', 'data', 'error', 'count', 'status', 'message', 'details', 'key', 'id', 'user_id', 'created_at', 'updated_at', 'select', 'insert', 'update', 'delete', 'from', 'where', 'order', 'group'].includes(col)) continue
            if (SQL_KEYWORDS.has(col)) continue
            columns.get(normalized)!.add(col)
            rawRefs.push({ table: normalized, file, line: lineNum, context: line.trim(), type: 'column' })
          }

          const queryTable = extractTableFromQuery(line)
          if (queryTable && !SQL_KEYWORDS.has(queryTable) && !FRONTEND_SKIP.has(queryTable)) {
            tables.add(queryTable)
            rawRefs.push({ table: queryTable, file, line: lineNum, context: line.trim(), type: 'select' })
          }
        }
      }
    }
  }

  return { tables, columns, rpcs, policies, rawRefs }
}

export function scanMigrations(): {
  tables: Set<string>
  columns: Map<string, Set<string>>
  rls: Set<string>
  policies: Map<string, Set<string>>
  functions: Set<string>
  rpcs: Set<string>
  views: Set<string>
} {
  const tables = new Set<string>()
  const columns = new Map<string, Set<string>>()
  const rls = new Set<string>()
  const policies = new Map<string, Set<string>>()
  const functions = new Set<string>()
  const rpcs = new Set<string>()
  const views = new Set<string>()

  const files = SQL_FILES

  for (const fullPath of files) {
    let content: string
    try {
      content = fs.readFileSync(fullPath, 'utf-8')
    } catch {
      continue
    }

    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      const unquoted = trimmed.replace(/"/g, '')

      const createTableMatch = unquoted.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/i)
      if (createTableMatch && !trimmed.includes('CREATE OR REPLACE')) {
        tables.add(createTableMatch[1].toLowerCase())
        continue
      }

      const createViewMatch = unquoted.match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?([a-z_][a-z0-9_]*)/i)
      if (createViewMatch) {
        views.add(createViewMatch[1].toLowerCase())
        continue
      }

      const createMatViewMatch = unquoted.match(/CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\s+(?:public\.)?([a-z_][a-z0-9_]*)/i)
      if (createMatViewMatch) {
        views.add(createMatViewMatch[1].toLowerCase())
        continue
      }

      const addColumnMatch = unquoted.match(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i)
      if (addColumnMatch) {
        const t = addColumnMatch[1].toLowerCase()
        const c = addColumnMatch[2].toLowerCase()
        if (!columns.has(t)) columns.set(t, new Set())
        columns.get(t)!.add(c)
        continue
      }

      const rlsMatch = unquoted.match(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i)
      if (rlsMatch) {
        rls.add(rlsMatch[1].toLowerCase())
        continue
      }

      const policyMatch = unquoted.match(/CREATE\s+POLICY\s+([a-z_][a-z0-9_]*)\s+ON\s+(?:public\.)?([a-z_][a-z0-9_]*)/i)
      if (policyMatch) {
        const table = policyMatch[2].toLowerCase()
        const policy = policyMatch[1].toLowerCase()
        if (!policies.has(table)) policies.set(table, new Set())
        policies.get(table)!.add(policy)
        continue
      }

      const createFuncMatch = unquoted.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/i)
      if (createFuncMatch) {
        const name = createFuncMatch[1].toLowerCase()
        if (name.includes('tr_') || name.includes('trigger')) continue
        functions.add(name)
        continue
      }

      const grantMatch = unquoted.match(/GRANT\s+.*\s+ON\s+FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/i)
      if (grantMatch) {
        rpcs.add(grantMatch[1].toLowerCase())
        continue
      }
    }
  }

  return { tables, columns, rls, policies, functions, rpcs, views }
}

export function computeSchemaDiff(): SchemaDiff {
  const frontend = scanTypeScriptFiles()
  const migrations = scanMigrations()

  const migrationObjects = new Set([...migrations.tables, ...migrations.views])
  const missingTables = Array.from(frontend.tables).filter(t => !migrationObjects.has(t))
  const missingColumns: { table: string; column: string }[] = []
  for (const [table, cols] of frontend.columns.entries()) {
    const migCols = migrations.columns.get(table) || new Set()
    for (const col of cols) {
      if (!migCols.has(col)) {
        missingColumns.push({ table, column: col })
      }
    }
  }
  const missingRls = Array.from(frontend.tables).filter(t => !migrations.rls.has(t))
  const missingPolicies: { table: string; policy: string }[] = []
  for (const [table, frontPolicies] of frontend.policies.entries()) {
    const migPolicies = migrations.policies.get(table) || new Set()
    for (const policy of frontPolicies) {
      if (!migPolicies.has(policy)) {
        missingPolicies.push({ table, policy })
      }
    }
  }
  const missingFunctions = Array.from(frontend.rpcs).filter(f => !migrations.functions.has(f) && !migrations.rpcs.has(f))
  const missingRpc = Array.from(frontend.rpcs).filter(r => !migrations.functions.has(r) && !migrations.rpcs.has(r))

  return {
    missingTables,
    missingColumns,
    missingRls,
    missingPolicies,
    missingFunctions,
    missingRpc,
    references: frontend.rawRefs,
  }
}

export function generateFixSql(diff: SchemaDiff): string {
  const lines: string[] = []
  lines.push('-- Auto-generated schema fix by Mai Troll Schema Monitor')
  lines.push(`-- Generated at: ${new Date().toISOString()}`)
  lines.push('')

  if (diff.missingTables.length > 0) {
    lines.push('-- ============================================')
    lines.push('-- MISSING TABLES')
    lines.push('-- ============================================')
    for (const table of diff.missingTables) {
      lines.push(`-- TODO: Create table: ${table}`)
    }
    lines.push('')
  }

  if (diff.missingColumns.length > 0) {
    lines.push('-- ============================================')
    lines.push('-- MISSING COLUMNS')
    lines.push('-- ============================================')
    for (const { table, column } of diff.missingColumns) {
      lines.push(`-- TODO: Add column ${column} to table: ${table}`)
    }
    lines.push('')
  }

  if (diff.missingRls.length > 0) {
    lines.push('-- ============================================')
    lines.push('-- MISSING RLS')
    lines.push('-- ============================================')
    for (const table of diff.missingRls) {
      lines.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
    }
    lines.push('')
  }

  if (diff.missingPolicies.length > 0) {
    lines.push('-- ============================================')
    lines.push('-- MISSING POLICIES')
    lines.push('-- ============================================')
    for (const { table, policy } of diff.missingPolicies) {
      lines.push(`-- TODO: Create policy ${policy} on table ${table}`)
    }
    lines.push('')
  }

  if (diff.missingFunctions.length > 0) {
    lines.push('-- ============================================')
    lines.push('-- MISSING FUNCTIONS/RPCS')
    lines.push('-- ============================================')
    for (const fn of diff.missingFunctions) {
      lines.push(`-- TODO: Create function: ${fn}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function getFrontendReferences(): TableRef[] {
  const frontend = scanTypeScriptFiles()
  return frontend.rawRefs
}
