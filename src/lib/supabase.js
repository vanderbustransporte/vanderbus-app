import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mrfwcfuddvexqixfjnuh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZndjZnVkZHZleHFpeGZqbnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDk3OTEsImV4cCI6MjA5NTMyNTc5MX0.ILsvCNJVmbuKT2JhyCIfhhL1Acnft-Uk2ia5Nl8R1MQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
