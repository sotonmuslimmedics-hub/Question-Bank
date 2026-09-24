import fs from 'fs'
import { describe, it, expect } from 'vitest'
import { parseMcq, parsePractical } from '../src/lib/importers.js'
import { checkAnswer, parseAccepted } from '../src/lib/answers.js'
import { buildTree, flatten, descendantIds, pathOf, markLocks, addTotals, practisableIds } from '../src/lib/sections.js'

describe('answers', () => {
  it('ignores case, punctuation, accents', () => {
    expect(checkAnswer('  Left  Ventricle! ', ['left ventricle'])).toBe(true)
    expect(checkAnswer('', ['x'])).toBe(false)
  })
  it('splits accepted answers', () => expect(parseAccepted('a;b\nc')).toEqual(['a', 'b', 'c']))
})

describe('sections', () => {
  const rows = [
    { id: 'y', parent_id: null, name: 'Year 4', sort_order: 0, is_locked: false },
    { id: 'm', parent_id: 'y', name: 'Renal', sort_order: 0, is_locked: false },
    { id: 't', parent_id: 'm', name: 'Ureter', sort_order: 0, is_locked: true },
    { id: 'o', parent_id: 'zz', name: 'Orphan of hidden parent', sort_order: 1, is_locked: false },
  ]
  const { roots, nodes } = buildTree(rows)
  it('builds, flattens, paths', () => {
    expect(roots.map((r) => r.id)).toEqual(['y', 'o'])
    expect(flatten(roots).map((f) => f.pathLabel)[2]).toBe('Year 4 › Renal › Ureter')
    expect(pathOf(nodes, 't')).toBe('Year 4 › Renal › Ureter')
    expect(descendantIds(nodes.get('y'))).toEqual(['y', 'm', 't'])
  })
  it('locks inherit and are not practisable', () => {
    markLocks(roots)
    addTotals(roots, { m: 3, t: 5 }, { m: 1 })
    expect(nodes.get('y').totalCount).toBe(8)
    expect(nodes.get('y').totalDone).toBe(1)
    expect(practisableIds(nodes.get('y'))).toEqual(['m'])
  })
})

describe('importers', () => {
  it.skipIf(!fs.existsSync('/home/claude/mcq-import.csv'))('parses the real cleaned MCQ sheet', () => {
    const r = parseMcq(fs.readFileSync('/home/claude/mcq-import.csv', 'utf8'))
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(534)
    expect(r.rows[0].options.length).toBeGreaterThanOrEqual(2)
  })
  it('handles blank option columns and letter answers', () => {
    const r = parseMcq('module,question,a,b,c,d,e,correct\nRenal,"Q, one?",x,,z,,,C\n')
    expect(r.rows[0].options).toEqual(['x', 'z'])
    expect(r.rows[0].correct_option).toBe(1)
    expect(r.rows[0].path).toEqual(['Renal'])
  })
  it('reports bad rows and removes duplicates', () => {
    const r = parseMcq('question,a,b,correct\nQ1,x,y,Z\nQ2,x,y,a\nq2 ,x,y,a\n')
    expect(r.errors.length).toBe(1)
    expect(r.dupes).toBe(1)
    expect(r.rows.length).toBe(1)
  })
  it('parses practical rows', () => {
    const r = parsePractical('module,topic,q1,a1,q2,a2,image_url\nAnat,Hand,What bone?,Scaphoid; navicular,Which nerve?,Median,https://x\n')
    expect(r.rows[0].parts[0].accepted_answers).toEqual(['Scaphoid', 'navicular'])
    expect(r.rows[0].parts.length).toBe(2)
    expect(r.rows[0].source_url).toBe('https://x')
  })
})
