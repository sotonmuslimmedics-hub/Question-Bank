import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { buildTree, flatten, markLocks, fetchAll } from './sections'

// Loads the section tree the current user is allowed to see.
export function useSections() {
  const [state, setState] = useState({ roots: [], nodes: new Map(), flat: [], loading: true, error: '' })
  const reload = useCallback(async () => {
    try {
      const rows = await fetchAll(() => supabase.from('sections').select('id,parent_id,name,sort_order,is_locked,is_hidden').order('id'))
      const { roots, nodes } = buildTree(rows)
      markLocks(roots)
      setState({ roots, nodes, flat: flatten(roots), loading: false, error: '' })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }))
    }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}
