import React, { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowUpDown,
  Bold,
  Box,
  Download,
  Filter,
  Italic,
  Lock,
  Merge,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  Underline,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteOfficeSpreadsheet,
  duplicateOfficeSpreadsheet,
  fetchSpreadsheetCells,
  moveOfficeSpreadsheet,
  saveSpreadsheetCells,
  updateOfficeSpreadsheetTitle,
} from '@/services/officeService'
import type { OfficeFilePermission, OfficeFolder, OfficeSpreadsheet, OfficeSpreadsheetCell } from '@/types/office'

interface SpreadsheetEditorProps {
  user: { id: string }
  profile: any
  spreadsheet?: OfficeSpreadsheet | null
  folders: OfficeFolder[]
  permissionLevel: OfficeFilePermission
  onBack: () => void
  onRefresh: () => void
  onOpenShare: (fileId: string, fileType: 'spreadsheet', permissionLevel: OfficeFilePermission) => void
}

interface StylePatch {
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  backgroundColor?: string
  color?: string
  border?: string
}

const rows = 50
const cols = 26
const toolbarClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded border border-cyan-500/20 bg-slate-900 px-2 text-xs text-slate-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40'

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function colToIndex(column: string) {
  return [...column.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
}

function indexToCol(index: number) {
  let result = ''
  let value = index
  while (value >= 0) {
    result = String.fromCharCode((value % 26) + 65) + result
    value = Math.floor(value / 26) - 1
  }
  return result
}

function parseRef(ref: string) {
  const match = /^([A-Z]+)([0-9]+)$/i.exec(ref)
  if (!match) return null
  return { column: match[1].toUpperCase(), row: Number(match[2]), colIndex: colToIndex(match[1]), rowIndex: Number(match[2]) }
}

function parseRange(range: string) {
  const [start, end] = range.split(':').map((part) => part.trim().toUpperCase())
  const startRef = parseRef(start)
  const endRef = parseRef(end || start)
  if (!startRef || !endRef) return []

  const minCol = Math.min(startRef.colIndex, endRef.colIndex)
  const maxCol = Math.max(startRef.colIndex, endRef.colIndex)
  const minRow = Math.min(startRef.rowIndex, endRef.rowIndex)
  const maxRow = Math.max(startRef.rowIndex, endRef.rowIndex)
  const refs: string[] = []

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) refs.push(`${indexToCol(col)}${row}`)
  }

  return refs
}

function toNumber(value: unknown) {
  const numeric = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

function isCoveredMergedCell(ref: string, mergedCells: Record<string, { rows: number; cols: number }>) {
  const parsed = parseRef(ref)
  if (!parsed) return false

  for (const [topLeft, span] of Object.entries(mergedCells)) {
    const top = parseRef(topLeft)
    if (!top) continue
    const coveredRow = parsed.rowIndex >= top.rowIndex && parsed.rowIndex < top.rowIndex + span.rows
    const coveredCol = parsed.colIndex >= top.colIndex && parsed.colIndex < top.colIndex + span.cols
    if (topLeft !== ref && coveredRow && coveredCol) return true
  }

  return false
}

export default function SpreadsheetEditor({
  user,
  profile,
  spreadsheet,
  folders,
  permissionLevel,
  onBack,
  onRefresh,
  onOpenShare,
}: SpreadsheetEditorProps) {
  const saveTimer = useRef<number | null>(null)
  const [title, setTitle] = useState(spreadsheet?.title || 'Untitled Spreadsheet')
  const [selectedSheet, setSelectedSheet] = useState('Sheet 1')
  const [sheets, setSheets] = useState<string[]>(['Sheet 1'])
  const [cells, setCells] = useState<Record<string, OfficeSpreadsheetCell>>({})
  const [selectedCell, setSelectedCell] = useState('A1')
  const [selectedCellValue, setSelectedCellValue] = useState('')
  const [mergedCells, setMergedCells] = useState<Record<string, { rows: number; cols: number }>>({})
  const [frozenRows, setFrozenRows] = useState(1)
  const [frozenCols, setFrozenCols] = useState(1)
  const [folderId, setFolderId] = useState(spreadsheet?.folder_id || '')
  const [search, setSearch] = useState('')
  const [filterText, setFilterText] = useState('')
  const [chartRange, setChartRange] = useState('')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area'>('bar')
  const [presence, setPresence] = useState<Record<string, any[]>>({})
  const [isSaving, setIsSaving] = useState(false)

  const canEdit = permissionLevel === 'owner' || permissionLevel === 'editor'

  const sheetCells = useMemo(() => {
    return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell.sheet_name === selectedSheet))
  }, [cells, selectedSheet])

  const evaluatedCells = useMemo(() => {
    const result: Record<string, string> = {}
    const resolve = (ref: string, stack: string[] = []): string => {
      if (stack.includes(ref)) return ''
      const cell = sheetCells[ref]
      if (!cell?.formula) return cell?.value || ''
      if (cell.formula.startsWith('=')) result[ref] = evaluateFormula(cell.formula.slice(1), sheetCells, resolve, stack.concat(ref))
      return result[ref] || ''
    }

    Object.keys(sheetCells).forEach((ref) => resolve(ref))
    return result
  }, [sheetCells])

  const chartData = useMemo(() => {
    if (!chartRange) return []
    const refs = parseRange(chartRange)
    if (refs.length < 2) return []

    const header = evaluatedCells[refs[0]] || refs[0]
    return refs.slice(1).map((ref) => ({
      name: evaluatedCells[ref] || ref,
      value: toNumber(evaluatedCells[ref]),
      header,
    }))
  }, [chartRange, evaluatedCells])

  useEffect(() => {
    if (!spreadsheet?.id) return
    fetchSpreadsheetCells(spreadsheet.id)
      .then((fetchedCells) => {
        setCells(Object.fromEntries(fetchedCells.map((cell) => [cell.cell_reference, cell])))
        setMergedCells(Object.fromEntries(fetchedCells.filter((cell) => cell.style_json?.merge).map((cell) => [cell.cell_reference, cell.style_json?.merge])))
        setSheets([...new Set(fetchedCells.map((cell) => cell.sheet_name).filter(Boolean))].length ? [...new Set(fetchedCells.map((cell) => cell.sheet_name))] : ['Sheet 1'])
      })
      .catch(() => undefined)
  }, [spreadsheet?.id])

  useEffect(() => {
    if (!spreadsheet?.id) return
    const channel = supabase.channel(`office:${spreadsheet.id}`)
    channel
      .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
      .subscribe(async (status) => {
        if ((status as string) === 'presented') {
          await channel.track({ user_id: user.id, name: profile?.username || profile?.display_name || 'MaiTroll User' })
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, spreadsheet?.id, user.id])

  useEffect(() => {
    if (!spreadsheet?.id || !canEdit) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => persistCells(), 900)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [canEdit, cells, mergedCells, spreadsheet?.id])

function evaluateFormula(formula: string, cellMap: Record<string, OfficeSpreadsheetCell>, resolve: (ref: string, stack?: string[]) => string, stack: string[] = []) {
    let expr = formula.trim()

    // Handle string literals first
    const strings: string[] = []
    expr = expr.replace(/"([^"]*)"/g, (_, s) => {
      strings.push(s)
      return `__STR_${strings.length - 1}__`
    })

    // Replace cell references and ranges with resolved numeric values
    expr = expr.replace(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/gi, (_, start: string, end: string) => {
      const refs = parseRange(`${start}:${end}`)
      const vals = refs.map(ref => {
        const raw = resolve(ref, stack)
        const n = toNumber(raw)
        return String(n)
      })
      return vals.join(',')
    })

    expr = expr.replace(/([A-Z]+[0-9]+)(?![A-Z0-9_])/gi, (_, ref: string) => {
      const raw = resolve(ref.toUpperCase(), stack)
      return String(toNumber(raw))
    })

    // Restore string literals
    expr = expr.replace(/__STR_(\d+)__/g, (_, i) => `"${strings[Number(i)]}"`)

    // Tokenize
    const tokens = tokenize(expr)
    const pos = { value: 0 }
    const result = parseExpression(tokens, pos)

    if (typeof result === 'number') {
      return String(Number.isFinite(result) ? result : 0)
    }
    return String(result)
  }

  // Token types for the safe formula parser
  type Token = { type: 'NUM'; value: number }
    | { type: 'STR'; value: string }
    | { type: 'OP'; value: string }
    | { type: 'LPAREN' }
    | { type: 'RPAREN' }
    | { type: 'COMMA' }
    | { type: 'FUNC'; name: string }
    | { type: 'BOOL'; value: boolean }
    | { type: 'COMP'; value: string }

  function tokenize(input: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    const s = input.trim()

    while (i < s.length) {
      const ch = s[i]

      // Whitespace
      if (/\s/.test(ch)) { i++; continue }

      // String literal
      if (ch === '"') {
        let str = ''
        i++
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\' && i + 1 < s.length) { i++; str += s[i] }
          else str += s[i]
          i++
        }
        i++ // skip closing quote
        tokens.push({ type: 'STR', value: str })
        continue
      }

      // Number (including negative handled by operator)
      if (/[0-9.]/.test(ch)) {
        let num = ''
        while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++ }
        tokens.push({ type: 'NUM', value: parseFloat(num) })
        continue
      }

      // Comparison operators
      if (ch === '=' && i + 1 < s.length && s[i + 1] === '=') { tokens.push({ type: 'COMP', value: '==' }); i += 2; continue }
      if (ch === '<' && i + 1 < s.length && s[i + 1] === '=') { tokens.push({ type: 'COMP', value: '<=' }); i += 2; continue }
      if (ch === '>' && i + 1 < s.length && s[i + 1] === '=') { tokens.push({ type: 'COMP', value: '>=' }); i += 2; continue }
      if (ch === '<' && i + 1 < s.length && s[i + 1] === '>') { tokens.push({ type: 'COMP', value: '<>' }); i += 2; continue }
      if (ch === '<') { tokens.push({ type: 'COMP', value: '<' }); i++; continue }
      if (ch === '>') { tokens.push({ type: 'COMP', value: '>' }); i++; continue }

      // Two-character operators
      if (ch === '&' && i + 1 < s.length && s[i + 1] === '&') { tokens.push({ type: 'OP', value: '&&' }); i += 2; continue }
      if (ch === '|' && i + 1 < s.length && s[i + 1] === '|') { tokens.push({ type: 'OP', value: '||' }); i += 2; continue }

      // Single-character operators
      if ('+-*/^%'.includes(ch)) { tokens.push({ type: 'OP', value: ch }); i++; continue }

      // Parentheses and comma
      if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue }
      if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue }
      if (ch === ',') { tokens.push({ type: 'COMMA' }); i++; continue }

      // Boolean literals
      if (s.substring(i, i + 4).toUpperCase() === 'TRUE' && (i + 4 >= s.length || !/[A-Z0-9]/.test(s[i + 4]))) {
        tokens.push({ type: 'BOOL', value: true }); i += 4; continue
      }
      if (s.substring(i, i + 5).toUpperCase() === 'FALSE' && (i + 5 >= s.length || !/[A-Z0-9]/.test(s[i + 5]))) {
        tokens.push({ type: 'BOOL', value: false }); i += 5; continue
      }

      // Function names and identifiers
      if (/[A-Z_]/i.test(ch)) {
        let name = ''
        while (i < s.length && /[A-Z0-9_]/i.test(s[i])) { name += s[i]; i++ }
        const upper = name.toUpperCase()
        const funcs = new Set(['SUM', 'AVG', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'ROUND', 'IF', 'AND', 'OR', 'NOT', 'ABS', 'SQRT', 'POWER', 'MOD', 'CEILING', 'FLOOR', 'CONCATENATE', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'LEFT', 'RIGHT', 'MID', 'FIND', 'SUBSTITUTE', 'VALUE', 'TEXT', 'ISNUMBER', 'ISBLANK', 'TODAY', 'NOW'])
        if (funcs.has(upper)) {
          tokens.push({ type: 'FUNC', name: upper })
        } else {
          // Unknown identifier — treat as 0
          tokens.push({ type: 'NUM', value: 0 })
        }
        continue
      }

      // Skip unknown characters
      i++
    }

    return tokens
  }

  // Recursive descent parser
  // Precedence (lowest to highest): comparison, addition/subtraction, multiplication/division, unary, power, functions/parens/values

  function parseExpression(tokens: Token[], pos: { value: number }): number | string {
    return parseComparison(tokens, pos)
  }

  function parseComparison(tokens: Token[], pos: { value: number }): number | string {
    let left = parseAddSub(tokens, pos)
    while (pos.value < tokens.length && tokens[pos.value].type === 'COMP') {
      const op = (tokens[pos.value] as { type: 'COMP'; value: string }).value
      pos.value++
      const right = parseAddSub(tokens, pos)
      const l = typeof left === 'string' ? left : Number(left)
      const r = typeof right === 'string' ? right : Number(right)
      let result: boolean
      switch (op) {
        case '==': result = l === r; break
        case '<>': result = l !== r; break
        case '<': result = Number(l) < Number(r); break
        case '>': result = Number(l) > Number(r); break
        case '<=': result = Number(l) <= Number(r); break
        case '>=': result = Number(l) >= Number(r); break
        default: result = false
      }
      left = result ? 1 : 0
    }
    return left
  }

  function parseAddSub(tokens: Token[], pos: { value: number }): number | string {
    let left = parseMulDiv(tokens, pos)
    while (pos.value < tokens.length && tokens[pos.value].type === 'OP' && ((tokens[pos.value] as any).value === '+' || (tokens[pos.value] as any).value === '-')) {
      const op = (tokens[pos.value] as { type: 'OP'; value: string }).value
      pos.value++
      const right = parseMulDiv(tokens, pos)
      if (op === '+') {
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right)
        } else {
          left = Number(left) + Number(right)
        }
      } else {
        left = (typeof left === 'number' ? left : toNumber(left)) - (typeof right === 'number' ? right : toNumber(right))
      }
    }
    return left
  }

  function parseMulDiv(tokens: Token[], pos: { value: number }): number | string {
    let left = parsePower(tokens, pos)
    while (pos.value < tokens.length && tokens[pos.value].type === 'OP') {
      const op = (tokens[pos.value] as { type: 'OP'; value: string }).value
      if (op !== '*' && op !== '/' && op !== '%') break
      pos.value++
      const right = parsePower(tokens, pos)
      const l = typeof left === 'number' ? left : toNumber(left)
      const r = typeof right === 'number' ? right : toNumber(right)
      if (op === '*') left = l * r
      else if (op === '/') left = r !== 0 ? l / r : 0
      else left = r !== 0 ? l % r : 0
    }
    return left
  }

  function parsePower(tokens: Token[], pos: { value: number }): number | string {
    let left = parseUnary(tokens, pos)
    while (pos.value < tokens.length && tokens[pos.value].type === 'OP' && (tokens[pos.value] as any).value === '^') {
      pos.value++
      const right = parseUnary(tokens, pos)
      left = Math.pow(typeof left === 'number' ? left : toNumber(left), typeof right === 'number' ? right : toNumber(right))
    }
    return left
  }

  function parseUnary(tokens: Token[], pos: { value: number }): number | string {
    if (pos.value < tokens.length && tokens[pos.value].type === 'OP' && ((tokens[pos.value] as any).value === '+' || (tokens[pos.value] as any).value === '-')) {
      const op = (tokens[pos.value] as { type: 'OP'; value: string }).value
      pos.value++
      const val = parseUnary(tokens, pos)
      return op === '-' ? -(typeof val === 'number' ? val : toNumber(val)) : val
    }
    return parsePrimary(tokens, pos)
  }

  function parsePrimary(tokens: Token[], pos: { value: number }): number | string {
    if (pos.value >= tokens.length) return 0

    const token = tokens[pos.value]

    // Number literal
    if (token.type === 'NUM') {
      pos.value++
      return token.value
    }

    // String literal
    if (token.type === 'STR') {
      pos.value++
      return token.value
    }

    // Boolean
    if (token.type === 'BOOL') {
      pos.value++
      return token.value ? 1 : 0
    }

    // Function call
    if (token.type === 'FUNC') {
      return parseFunction(tokens, pos)
    }

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      pos.value++
      const val = parseExpression(tokens, pos)
      if (pos.value < tokens.length && tokens[pos.value].type === 'RPAREN') pos.value++
      return val
    }

    // Skip unknown
    pos.value++
    return 0
  }

  function parseFunction(tokens: Token[], pos: { value: number }): number | string {
    const name = (tokens[pos.value] as { type: 'FUNC'; name: string }).name
    pos.value++ // consume func name
    if (pos.value < tokens.length && tokens[pos.value].type === 'LPAREN') pos.value++

    const args: (number | string)[] = []
    while (pos.value < tokens.length && tokens[pos.value].type !== 'RPAREN') {
      args.push(parseExpression(tokens, pos))
      if (pos.value < tokens.length && tokens[pos.value].type === 'COMMA') pos.value++
    }
    if (pos.value < tokens.length && tokens[pos.value].type === 'RPAREN') pos.value++

    const nums = args.map(a => typeof a === 'number' ? a : toNumber(a))
    const strs = args.map(a => String(a))

    switch (name) {
      case 'SUM': return nums.reduce((s, n) => s + n, 0)
      case 'AVG':
      case 'AVERAGE': return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0
      case 'COUNT': return nums.length
      case 'MIN': return nums.length ? Math.min(...nums) : 0
      case 'MAX': return nums.length ? Math.max(...nums) : 0
      case 'ROUND': return nums.length ? Number(nums[0].toFixed(Math.max(0, Math.floor(nums[1] || 0)))) : 0
      case 'IF': return (typeof args[0] === 'number' ? args[0] !== 0 : toNumber(args[0]) !== 0) ? args[1] : args[2]
      case 'AND': return args.every(a => (typeof a === 'number' ? a !== 0 : toNumber(a) !== 0)) ? 1 : 0
      case 'OR': return args.some(a => (typeof a === 'number' ? a !== 0 : toNumber(a) !== 0)) ? 1 : 0
      case 'NOT': return (typeof args[0] === 'number' ? args[0] === 0 : toNumber(args[0]) === 0) ? 1 : 0
      case 'ABS': return Math.abs(nums[0] || 0)
      case 'SQRT': return Math.sqrt(Math.max(0, nums[0] || 0))
      case 'POWER': return Math.pow(nums[0] || 0, nums[1] || 0)
      case 'MOD': return (nums[1] || 1) !== 0 ? (nums[0] || 0) % (nums[1] || 1) : 0
      case 'CEILING': return Math.ceil(nums[0] || 0)
      case 'FLOOR': return Math.floor(nums[0] || 0)
      case 'CONCATENATE': return strs.join('')
      case 'LEN': return strs[0].length
      case 'UPPER': return strs[0].toUpperCase()
      case 'LOWER': return strs[0].toLowerCase()
      case 'TRIM': return strs[0].trim()
      case 'LEFT': return strs[0].substring(0, nums[1] || 1)
      case 'RIGHT': return strs[0].substring(Math.max(0, strs[0].length - (nums[1] || 1)))
      case 'MID': return strs[0].substring(Math.max(0, (nums[1] || 1) - 1), Math.max(0, (nums[1] || 1) - 1) + (nums[2] || 1))
      case 'FIND': return strs[1].indexOf(strs[0]) + 1
      case 'SUBSTITUTE': return strs[0].split(strs[1]).join(strs[2])
      case 'VALUE': return toNumber(strs[0])
      case 'TEXT': return strs[0]
      case 'ISNUMBER': return typeof args[0] === 'number' && Number.isFinite(args[0]) ? 1 : 0
      case 'ISBLANK': return (args[0] === '' || args[0] === 0 || args[0] === undefined || args[0] === null) ? 1 : 0
      case 'TODAY': return new Date().toLocaleDateString()
      case 'NOW': return new Date().toLocaleString()
      default: return 0
    }
  }

  function getCellDisplay(ref: string) {
    const cell = sheetCells[ref]
    if (!cell) return ''
    if (cell.formula?.startsWith('=')) return evaluatedCells[ref] || ''
    return cell.value || ''
  }

  function updateCell(ref: string, value: string) {
    if (!canEdit) return
    const cell: OfficeSpreadsheetCell = {
      spreadsheet_id: spreadsheet?.id || '',
      sheet_name: selectedSheet,
      cell_reference: ref,
      value,
      formula: value.startsWith('=') ? value : null,
      style_json: cells[ref]?.style_json || {},
    }
    setCells((current) => ({ ...current, [ref]: cell }))
  }

  function applyStyle(patch: StylePatch) {
    if (!canEdit) return
    setCells((current) => {
      const cell = current[selectedCell]
      const style = { ...(cell?.style_json || {}), ...(patch as Record<string, any>) }
      return { ...current, [selectedCell]: { ...cell!, sheet_name: selectedSheet, cell_reference: selectedCell, value: cell?.value || '', formula: cell?.formula || null, style_json: style } }
    })
  }

  function mergeSelectedCells() {
    const spanRows = Number(window.prompt('Rows to merge', '2')) || 2
    const spanCols = Number(window.prompt('Columns to merge', '2')) || 2
    setMergedCells((current) => ({ ...current, [selectedCell]: { rows: spanRows, cols: spanCols } }))
  }

  function persistCells() {
    if (!spreadsheet?.id || !canEdit) return
    setIsSaving(true)
    const allCells = Object.values(cells).map((cell) => {
      const style = { ...(cell.style_json || {}) }
      if (mergedCells[cell.cell_reference]) style.merge = mergedCells[cell.cell_reference]
      return { ...cell, style_json: style }
    })

    saveSpreadsheetCells(spreadsheet.id, allCells)
      .then(() => {
        toast.success('Spreadsheet saved.')
        onRefresh()
      })
      .catch((err: any) => toast.error(err?.message || 'Failed to save spreadsheet.'))
      .finally(() => setIsSaving(false))
  }

  async function saveTitle() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await updateOfficeSpreadsheetTitle(spreadsheet.id, title)
      toast.success('Spreadsheet renamed.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to rename spreadsheet.')
    }
  }

  async function moveSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await moveOfficeSpreadsheet(spreadsheet.id, folderId || null)
      toast.success('Spreadsheet moved.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move spreadsheet.')
    }
  }

  async function duplicateSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await duplicateOfficeSpreadsheet(spreadsheet.id, user.id)
      toast.success('Spreadsheet duplicated.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate spreadsheet.')
    }
  }

  async function deleteSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    if (!window.confirm('Delete this spreadsheet?')) return
    try {
      await deleteOfficeSpreadsheet(spreadsheet.id)
      toast.success('Spreadsheet deleted.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete spreadsheet.')
    }
  }

  function addSheet() {
    const name = window.prompt('Sheet name', `Sheet ${sheets.length + 1}`)
    if (!name) return
    setSheets((current) => [...current, name])
    setSelectedSheet(name)
  }

  function removeSheet() {
    if (sheets.length === 1) {
      toast.error('A spreadsheet needs at least one sheet.')
      return
    }
    setSheets((current) => current.filter((sheet) => sheet !== selectedSheet))
    setSelectedSheet(sheets.find((sheet) => sheet !== selectedSheet) || 'Sheet 1')
  }

  function exportCsv() {
    const header = Array.from({ length: cols }, (_, index) => indexToCol(index)).join(',')
    const body = Array.from({ length: rows }, (_, rowIndex) => Array.from({ length: cols }, (_, colIndex) => {
      const ref = `${indexToCol(colIndex)}${rowIndex + 1}`
      return `"${(getCellDisplay(ref) || '').replace(/"/g, '""')}"`
    }).join(',')).join('\n')
    downloadFile(`${title || 'spreadsheet'}.csv`, `${header}\n${body}`, 'text/csv')
  }

  function exportXlsx() {
    const html = `<html><head><meta charset="utf-8"></head><body><table>${Array.from({ length: rows }, (_, rowIndex) => `<tr>${Array.from({ length: cols }, (_, colIndex) => `<td>${getCellDisplay(`${indexToCol(colIndex)}${rowIndex + 1}`) || ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`
    downloadFile(`${title || 'spreadsheet'}.xlsx`, html, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    let y = 12
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const line = Array.from({ length: 8 }, (_, colIndex) => `${indexToCol(colIndex)}:${getCellDisplay(`${indexToCol(colIndex)}${rowIndex + 1}`) || ''}`).join(' | ')
      if (y > 180) {
        doc.addPage()
        y = 12
      }
      doc.text(line, 10, y)
      y += 6
    }
    doc.save(`${title || 'spreadsheet'}.pdf`)
  }

  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !canEdit) return
    file.text().then((text) => {
      const nextCells: Record<string, OfficeSpreadsheetCell> = { ...cells }
      text.split('\n').forEach((line, rowIndex) => {
        line.split(',').forEach((value, colIndex) => {
          if (colIndex >= cols) return
          const ref = `${indexToCol(colIndex)}${rowIndex + 1}`
          nextCells[ref] = { spreadsheet_id: spreadsheet?.id || '', sheet_name: selectedSheet, cell_reference: ref, value: value.replace(/^"|"$/g, ''), formula: null, style_json: {} }
        })
      })
      setCells(nextCells)
      toast.success('CSV imported.')
    })
  }

  function sortRows() {
    const target = window.prompt('Sort by cell reference', 'A1')?.toUpperCase()
    if (!target) return
    toast.success(`Sort ready for ${target}.`)
  }

  function renderChart() {
    if (!chartData.length) return <p className="py-8 text-center text-slate-500">Choose a range like A1:B6 to render a chart.</p>

    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
              {chartData.map((_, index) => <Cell key={index} fill={['#22d3ee', '#a855f7', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#22d3ee" fillOpacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const visibleRows = Array.from({ length: rows }, (_, index) => index + 1)
  const visibleCols = Array.from({ length: cols }, (_, index) => index)

  return (
    <div className="min-h-screen bg-[#0A0814] text-white" dir="ltr">
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="border border-cyan-500/20 text-cyan-200 hover:bg-cyan-500/20">Back</Button>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} disabled={!canEdit} className="max-w-md border-cyan-500/30 bg-slate-900 text-white" />
            {Object.keys(presence).length > 0 && <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">{Object.values(presence).flat().map((item: any) => item.name).join(', ')}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onOpenShare(spreadsheet?.id || '', 'spreadsheet', permissionLevel)} disabled={!spreadsheet?.id || !canEdit} className="border border-white/10 text-slate-200"><Share2 className="mr-2 h-4 w-4" />Share</Button>
            <Button variant="ghost" onClick={persistCells} disabled={!canEdit || isSaving} className="border border-white/10 text-slate-200"><Save className="mr-2 h-4 w-4" />{isSaving ? 'Saving...' : 'Save'}</Button>
            <Button variant="ghost" onClick={exportCsv} className="border border-white/10 text-slate-200"><Download className="mr-2 h-4 w-4" />CSV</Button>
            <Button variant="ghost" onClick={exportXlsx} className="border border-white/10 text-slate-200">XLSX</Button>
            <Button variant="ghost" onClick={exportPdf} className="border border-white/10 text-slate-200">PDF</Button>
            <Button variant="ghost" onClick={duplicateSpreadsheet} disabled={!canEdit} className="border border-white/10 text-slate-200">Duplicate</Button>
            <Button variant="ghost" onClick={deleteSpreadsheet} disabled={!canEdit} className="border border-red-500/20 text-red-300"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-2">
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ fontWeight: '700' })} className={toolbarClass}><Bold className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ fontStyle: 'italic' })} className={toolbarClass}><Italic className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ textDecoration: 'underline' })} className={toolbarClass}><Underline className="h-4 w-4" /></Button>
          <input disabled={!canEdit} type="color" onChange={(e) => applyStyle({ backgroundColor: e.target.value })} className="h-8 w-10 rounded border border-cyan-500/20 bg-slate-900" />
          <input disabled={!canEdit} type="color" onChange={(e) => applyStyle({ color: e.target.value })} className="h-8 w-10 rounded border border-cyan-500/20 bg-slate-900" />
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ border: '1px solid #475569' })} className={toolbarClass}><Box className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={mergeSelectedCells} className={toolbarClass}><Merge className="h-4 w-4" />Merge</Button>
          <select disabled={!canEdit} onChange={(e) => setFrozenRows(Number(e.target.value))} value={frozenRows} className={toolbarClass}><option value={1}>Freeze 1 row</option><option value={2}>Freeze 2 rows</option><option value={0}>No frozen rows</option></select>
          <select disabled={!canEdit} onChange={(e) => setFrozenCols(Number(e.target.value))} value={frozenCols} className={toolbarClass}><option value={1}>Freeze 1 col</option><option value={2}>Freeze 2 cols</option><option value={0}>No frozen cols</option></select>
          <Button type="button" variant="ghost" onClick={sortRows} className={toolbarClass}><ArrowUpDown className="h-4 w-4" />Sort</Button>
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cells" className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs" /></div>
          <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter" className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs" /></div>
          <Input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={!canEdit} className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs file:mr-2 file:text-cyan-300" />
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={!canEdit} className={toolbarClass}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          <Button type="button" variant="ghost" onClick={moveSpreadsheet} disabled={!canEdit} className={toolbarClass}>Move</Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {sheets.map((sheet) => (
            <button key={sheet} onClick={() => setSelectedSheet(sheet)} className={`rounded-full border px-3 py-1 text-sm ${selectedSheet === sheet ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>{sheet}</button>
          ))}
          <Button size="sm" variant="ghost" onClick={addSheet} disabled={!canEdit} className="h-8 border border-cyan-500/20 text-cyan-200"><Plus className="mr-1 h-3 w-3" />Sheet</Button>
          <Button size="sm" variant="ghost" onClick={removeSheet} disabled={!canEdit || sheets.length === 1} className="h-8 border border-red-500/20 text-red-300">Remove</Button>
          <Input value={selectedCellValue} onChange={(e) => { setSelectedCellValue(e.target.value); updateCell(selectedCell, e.target.value) }} className="h-9 w-64 border-cyan-500/30 bg-slate-900 text-white" placeholder={`${selectedCell} value/formula`} />
        </div>

        {!canEdit && <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-100"><Lock className="h-4 w-4" />Read-only spreadsheet. You can view, download, print, or save a personal copy.</div>}

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-2">
            <div className="inline-block min-w-max">
              {visibleRows.map((rowIndex) => (
                <div key={rowIndex} className="flex">
                  <div className={`sticky left-0 z-20 flex h-8 w-10 items-center justify-center border border-slate-700 bg-slate-800 text-xs text-slate-300 ${rowIndex <= frozenRows ? 'top-0 z-30' : ''}`}>{rowIndex}</div>
                  {visibleCols.map((colIndex) => {
                    const ref = `${indexToCol(colIndex)}${rowIndex}`
                    const value = getCellDisplay(ref)
                    const cell = sheetCells[ref]
                    const style = cell?.style_json || {}
                    const hidden = isCoveredMergedCell(ref, mergedCells)
                    const matchesSearch = search ? value.toLowerCase().includes(search.toLowerCase()) : true
                    const matchesFilter = filterText ? value.toLowerCase().includes(filterText.toLowerCase()) : true
                    if (!matchesSearch || !matchesFilter || hidden) return <div key={ref} className="h-8 w-28 border border-slate-800 bg-slate-950/30" />

                    return (
                      <input
                        key={ref}
                        value={selectedCell === ref ? selectedCellValue : value}
                        onChange={(e) => {
                          setSelectedCell(ref)
                          setSelectedCellValue(e.target.value)
                          updateCell(ref, e.target.value)
                        }}
                        onFocus={() => { setSelectedCell(ref); setSelectedCellValue(value) }}
                        disabled={!canEdit}
                        className={`h-8 w-28 border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none focus:border-cyan-400 ${rowIndex <= frozenRows ? 'sticky top-0 z-20' : ''} ${colIndex < frozenCols ? 'sticky left-10 z-10' : ''}`}
                        style={{ fontWeight: style.fontWeight, fontStyle: style.fontStyle, textDecoration: style.textDecoration, backgroundColor: style.backgroundColor, color: style.color, border: style.border || '1px solid #334155' }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4">
            <div>
              <h3 className="mb-2 font-bold text-cyan-200">Charts</h3>
              <Input value={chartRange} onChange={(e) => setChartRange(e.target.value.toUpperCase())} placeholder="Range e.g. A1:B6" className="mb-2 border-cyan-500/30 bg-slate-900 text-white" />
              <select value={chartType} onChange={(e) => setChartType(e.target.value as any)} className="mb-3 w-full rounded border border-cyan-500/30 bg-slate-900 p-2 text-white">
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="area">Area Chart</option>
              </select>
              {renderChart()}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <p className="text-sm font-bold text-white">{selectedCell}</p>
              <p className="text-xs text-slate-400">{sheetCells[selectedCell]?.formula ? `Formula: ${sheetCells[selectedCell].formula}` : 'Plain value'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
