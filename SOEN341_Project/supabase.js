import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://enxoxjoeqvlxqnfpmpim.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueG94am9lcXZseHFuZnBtcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM0ODksImV4cCI6MjA4NzUyOTQ4OX0.31he6qAZCmo6z8niggBxzQXMjAPi3n8wGqxS5Z_63YM";

export const supabase = createClient(supabaseUrl, supabaseKey);
