// Helpers for the flexible section tree (Year group > Module > Topic > ...).

const byOrder = (a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, undefined, { numeric: true })

export function buildTree(rows) {
  const nodes = new Map(rows.map((r) => [r.id, { ...r, children: [] }]))
  const roots = []
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : null
    if (parent) parent.children.push(n)
    else roots.push(n) // also catches sections whose parent the viewer cannot see
  }
  const sortDeep = (list) => {
    list.sort(byOrder)
    list.forEach((n) => sortDeep(n.children))
  }
  sortDeep(roots)
  return { roots, nodes }
}

// Every section in tree order with its depth and full path, ready for a <select>.
export function flatten(roots, depth = 0, trail = [], out = []) {
  for (const n of roots) {
    const path = [...trail, n.name]
    out.push({ id: n.id, name: n.name, depth, path, pathLabel: path.join(' › '), node: n })
    flatten(n.children, depth + 1, path, out)
  }
  return out
}

export function descendantIds(node, out = []) {
  out.push(node.id)
  node.children.forEach((c) => descendantIds(c, out))
  return out
}

export function pathOf(nodes, id) {
  const parts = []
  let cur = nodes.get(id)
  let guard = 0
  while (cur && guard++ < 25) {
    parts.unshift(cur.name)
    cur = cur.parent_id ? nodes.get(cur.parent_id) : null
  }
  return parts.join(' › ')
}

// A section counts as locked when it or anything above it is locked.
export function markLocks(roots, inherited = false) {
  for (const n of roots) {
    n.effectiveLocked = inherited || n.is_locked
    markLocks(n.children, n.effectiveLocked)
  }
}

// Adds totals that include everything below each section.
export function addTotals(roots, counts = {}, progress = {}) {
  for (const n of roots) {
    addTotals(n.children, counts, progress)
    n.ownCount = counts[n.id] || 0
    n.ownDone = progress[n.id] || 0
    n.totalCount = n.ownCount + n.children.reduce((s, c) => s + c.totalCount, 0)
    n.totalDone = n.ownDone + n.children.reduce((s, c) => s + c.totalDone, 0)
  }
}

// Sections below `node` (inclusive) that can be practised: they hold questions and are not locked.
export function practisableIds(node) {
  const out = []
  const walk = (n) => {
    if (n.ownCount > 0 && !n.effectiveLocked) out.push(n.id)
    n.children.forEach(walk)
  }
  walk(node)
  return out
}

// Pages through a query so lists longer than the server's 1,000-row default are not cut off.
export async function fetchAll(makeQuery, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}
