import { describe, expect, it } from 'vitest'
import { toCSV, type CsvRow } from '@/lib/csv'
import { qualityCsv, workloadCsv } from '@/lib/report-csv'
import type { QcEntry } from '@/data/quality'
import type { WorkRow } from '@/lib/engine'
import { newPerson } from '@/data/types'

/**
 * These files leave the building. A payroll register goes to a bank and a
 * quality log goes to a client, and neither reader is a person who can spot that
 * a column slid one place to the left — so the tests here are exact strings, not
 * shapes. Two things have to hold: a value that contains a delimiter must not be
 * able to split its own row, and the column order must not be able to change
 * without a test going red.
 */

/**
 * A minimal RFC 4180 reader — what the receiving importer does with the file.
 * It exists so the quoting tests can assert the cells come back *out* the way
 * they went in, rather than only that some quote marks were emitted.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') cell += c
      else if (text[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (c === '"' && cell === '') quoted = true
    else if (c === ',') {
      rows[rows.length - 1].push(cell)
      cell = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      rows[rows.length - 1].push(cell)
      cell = ''
      rows.push([])
      i++
    } else cell += c
  }
  rows[rows.length - 1].push(cell)
  return rows
}

describe('the reader used by these tests', () => {
  /* A parser that is itself wrong would make every round-trip below pass for the
     wrong reason, so it is pinned against a hand-written file first. */
  it('reads a quoted field, a doubled quote and a CRLF row break', () => {
    expect(parseCSV('a,b\r\n"c,d",e')).toEqual([
      ['a', 'b'],
      ['c,d', 'e'],
    ])
    expect(parseCSV('"say ""hi""",2')).toEqual([['say "hi"', '2']])
  })
})

describe('quoting', () => {
  it('quotes a value containing a comma', () => {
    expect(toCSV([['Smith, John', 'Search']])).toBe('"Smith, John",Search')
  })

  it('doubles an embedded quote and wraps the value', () => {
    expect(toCSV([['reference reads "as recorded"', 4]])).toBe(
      '"reference reads ""as recorded""",4',
    )
  })

  it('keeps a value containing a newline inside one cell', () => {
    /* The row break is CRLF; a newline *within* a value stays the LF it was, and
       the quoting is what keeps the two apart. */
    expect(toCSV([['first line\nsecond line'], ['next row']])).toBe(
      '"first line\nsecond line"\r\nnext row',
    )
  })

  it('hands back the same cells it was given, delimiters and all', () => {
    const rows: CsvRow[] = [
      ['Order', 'Reason'],
      ['ORD-1', 'index down, county called back'],
      ['ORD-2', 'client asked for the "clean" copy'],
      ['ORD-3', 'two problems:\nno plat, and no deed'],
    ]
    expect(parseCSV(toCSV(rows))).toEqual([
      ['Order', 'Reason'],
      ['ORD-1', 'index down, county called back'],
      ['ORD-2', 'client asked for the "clean" copy'],
      ['ORD-3', 'two problems:\nno plat, and no deed'],
    ])
  })

  it('is what stops those cells splitting their own row', () => {
    /* The counter-example. The same rows joined without the quoting — which is
       what every one of these exports was before there was a `toCSV` — arrive at
       the reader as a different table: the comma cell becomes three columns and
       the newline cell becomes two rows. So the assertion above is load-bearing
       rather than a restatement of the join. */
    const rows: CsvRow[] = [
      ['ORD-1', 'index down, county called back'],
      ['ORD-3', 'two problems:\nno plat, and no deed'],
    ]
    const naive = rows.map((r) => r.join(',')).join('\r\n')

    expect(parseCSV(naive)[0]).toHaveLength(3)
    expect(parseCSV(naive)[0]).not.toEqual(rows[0])
    expect(parseCSV(toCSV(rows))[0]).toHaveLength(2)
  })

  it('leaves an ordinary value alone', () => {
    /* Quoting everything would be safe and unreadable; the file is opened by
       people too. */
    expect(toCSV([['ORD-1', 'Search', 12]])).toBe('ORD-1,Search,12')
  })
})

describe('empty cells', () => {
  it('writes null and undefined as an empty cell, not as the word', () => {
    /* `String(null)` is "null", and a bank importer would take it as a value.
       An absent optional — `x.note ?? ''`, `l?.u` — has to arrive as blank. */
    expect(toCSV([['', null, undefined, 'x']])).toBe(',,,x')
  })

  it('writes a zero as a zero', () => {
    /* A falsy guard here would blank every nil deduction on the payroll
       register, and a blank in the PT column is not the same claim as ₹0. */
    expect(toCSV([['PT', 0]])).toBe('PT,0')
  })

  it('keeps the column count of a row that is empty end to end', () => {
    expect(toCSV([[null, null, null]])).toBe(',,')
    expect(parseCSV(toCSV([[null, null, null]]))[0]).toHaveLength(3)
  })
})

describe('the file itself', () => {
  it('separates rows with CRLF and ends without one', () => {
    /* A trailing break reads as one more, empty, record. */
    expect(toCSV([['a'], ['b'], ['c']])).toBe('a\r\nb\r\nc')
  })
})

describe('column order', () => {
  const entry: QcEntry = {
    d: new Date(2026, 6, 29, 11, 0),
    dk: '07/29/2026',
    order: 'ORD-2291',
    cl: 'MGR',
    pr: 'COS',
    stage: 'Search',
    on: 'p1',
    onName: 'Uma Sankar',
    by: 'p2',
    byName: 'Asha Rao',
    acc: 4,
    comp: 5,
    fmt: 3,
    avg: 4,
    defect: true,
    crit: 'fmt',
    note: 'legal description truncated, and the vesting deed was missed',
  }

  /**
   * The one pin that has to be a literal. Every other test here would still pass
   * if two columns swapped, because they assert on the same builder that
   * produced them; this one is the file as the recipient sees it, written out by
   * hand. If it needs updating, the mapping on the other end needs updating too.
   */
  it('writes the quality log exactly as the recipient reads it', () => {
    expect(toCSV(qualityCsv([entry]).rows)).toBe(
      'Date,Order,Client,Product,Stage,Worked by,Rated by,Accuracy,Completeness,Formatting,Defect,Reason\r\n' +
        '07/29/2026,ORD-2291,MGR,COS,Search,Uma Sankar,Asha Rao,4,5,3,yes,' +
        '"legal description truncated, and the vesting deed was missed"',
    )
  })

  it('names the file after the report rather than the screen', () => {
    expect(qualityCsv([]).name).toBe('quality')
    expect(qualityCsv([]).rows).toHaveLength(1)
  })

  it('gives the two workload exports the same five columns under different names', () => {
    /* Per-person and per-department are the same report at two altitudes, and
       the design says so by giving them one column list. */
    const row: WorkRow = {
      s: { ...newPerson(), n: 'Asha Rao' },
      done: 7,
      pend: 3,
      tot: 10,
      pct: 70,
      items: [],
      stages: {},
    }
    const staff = workloadCsv([row], false)

    expect(staff.name).toBe('staff-workload')
    expect(toCSV(staff.rows)).toBe('Staff,Completed,Pending,Total,% complete\r\nAsha Rao,7,3,10,70')
    expect(workloadCsv([], true).rows[0]).toEqual([
      'Department',
      'Completed',
      'Pending',
      'Total',
      '% complete',
    ])
  })
})
