import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://wvjohorkzmktthzjteci.supabase.co"
const SUPABASE_KEY = "sb_publishable_dH4Mi80uBmRoNL9Jsj65tA_jwyWjHX5"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)