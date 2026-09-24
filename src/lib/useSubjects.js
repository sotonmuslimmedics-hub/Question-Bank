import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Loads the flat, admin-managed subject list (anatomy, physiology, pharmacology, ...).
export function useSubjects() {
  const [state, setState] = useState({ rows: [], loading: true, error: '' })
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('subjects').select('id,name,sort_order').order('sort_order').order('name')
    setState(error ? { rows: [], loading: false, error: error.message } : { rows: data || [], loading: false, error: '' })
  }, [])
  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}
