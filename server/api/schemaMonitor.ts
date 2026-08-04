import { Router, Request, Response } from 'express'
import { computeSchemaDiff, generateFixSql } from '../../src/lib/schemaScanner'
import fs from 'fs'
import path from 'path'

const router = Router()

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')

router.get('/schema-monitor', async (_req: Request, res: Response) => {
  try {
    const diff = computeSchemaDiff()
    const sql = generateFixSql(diff)

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        missingTables: diff.missingTables.length,
        missingColumns: diff.missingColumns.length,
        missingRls: diff.missingRls.length,
        missingPolicies: diff.missingPolicies.length,
        missingFunctions: diff.missingFunctions.length,
        missingRpc: diff.missingRpc.length,
        totalReferences: diff.references.length,
      },
      details: {
        missingTables: diff.missingTables,
        missingColumns: diff.missingColumns,
        missingRls: diff.missingRls,
        missingPolicies: diff.missingPolicies,
        missingFunctions: diff.missingFunctions,
        missingRpc: diff.missingRpc,
      },
      fixSql: sql,
    })
  } catch (error: any) {
    console.error('Schema monitor error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to scan schema',
      details: error?.message || String(error),
    })
  }
})

router.post('/schema-monitor', async (_req: Request, res: Response) => {
  try {
    const diff = computeSchemaDiff()
    const sql = generateFixSql(diff)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `${timestamp}_auto_fix_missing_schema.sql`
    const filepath = path.join(MIGRATIONS_DIR, filename)

    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true })
    fs.writeFileSync(filepath, sql, 'utf-8')

    res.json({
      success: true,
      message: `Generated migration: ${filename}`,
      filepath,
    })
  } catch (error: any) {
    console.error('Schema monitor save error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to save migration',
      details: error?.message || String(error),
    })
  }
})

export default router
