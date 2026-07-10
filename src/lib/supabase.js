import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin esto, Vite reemplaza las variables faltantes por undefined y la app
// arranca con un cliente roto que recién falla en la primera query.
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y completalas.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
