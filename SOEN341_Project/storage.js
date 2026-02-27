import { supabase } from "./supabase.js";

export async function findUser(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return null;
  return data;
}

export async function createUser(userData) {
  const { error } = await supabase.from("users").insert(userData);
  return !error;
}

export async function updateUser(email, updates) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("email", email)
    .select()
    .single();

  if (error) return null;
  return data;
}
