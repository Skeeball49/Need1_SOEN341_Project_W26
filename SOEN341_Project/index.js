import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { findUser, createUser, updateUser } from "./storage.js";
import { supabase } from "./supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("index.ejs"));

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await findUser(email);

  if (!user || user.password !== password) {
    return res.render("login.ejs", { error: "No account found. Please register first." });
  }

  return res.render("dashboard.ejs", { user });
});

app.get("/register", (req, res) => {
  res.render("register.ejs", { error: "" });
});

app.post("/register", async (req, res) => {
  const { email, password, ConfirmPassword } = req.body;

  if (!email || !password || !ConfirmPassword) {
    return res.render("register.ejs", { error: "Please fill in all fields." });
  }
  if (password !== ConfirmPassword) {
    return res.render("register.ejs", { error: "Passwords do not match." });
  }

  const exists = await findUser(email);
  if (exists) {
    return res.render("register.ejs", { error: "Account already exists. Please login." });
  }

  await createUser({ email, password, diet: "", allergies: "" });

  return res.redirect("/login");
});

app.get("/dashboard", (req, res) =>
    res.render("pages/dashboard", {
    user: {
      email: "demo@test.com",
      diet: "High protein",
      allergies: "None"
    }
  })
);

app.post("/update-profile", async (req, res) => {
  const { email, diet, allergies } = req.body;

  const user = await updateUser(email, { diet: diet || "", allergies: allergies || "" });

  if (!user) {
    return res.status(404).send("User not found");
  }

  return res.render("dashboard.ejs", { user });
});

app.get("/recipes", async (req, res) => {
  const { q = "", maxTime = "", difficulty = "", maxCost = "", tag = "" } = req.query;

  let query = supabase.from("recipes").select("*");

  if (q.trim()) {
    query = query.or(`title.ilike.%${q.trim()}%`);
  }
  if (maxTime) query = query.lte("prepTime", Number(maxTime));
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (maxCost) query = query.lte("cost", Number(maxCost));

  const { data: recipes } = await query;

  let filtered = recipes || [];
  // Filter by tag and ingredient search client-side (arrays)
  if (q.trim() && filtered.length === 0) {
    // Re-fetch all and filter by ingredient
    const { data: all } = await supabase.from("recipes").select("*");
    const needle = q.toLowerCase();
    filtered = (all || []).filter(r =>
      r.title.toLowerCase().includes(needle) ||
      (r.ingredients || []).join(" ").toLowerCase().includes(needle)
    );
    if (maxTime) filtered = filtered.filter(r => Number(r.prepTime) <= Number(maxTime));
    if (difficulty) filtered = filtered.filter(r => r.difficulty === difficulty);
    if (maxCost) filtered = filtered.filter(r => Number(r.cost) <= Number(maxCost));
  }
  if (tag.trim()) filtered = filtered.filter(r => (r.tags || []).includes(tag.trim()));

  res.render("recipes", { recipes: filtered, query: { q, maxTime, difficulty, maxCost, tag } });
});

app.get("/recipes/new", (req, res) => {
  res.render("recipe-form", { recipe: null, error: "" });
});

app.post("/recipes", async (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags } = req.body;

  if (!title || !ingredients || !steps) {
    return res.render("recipe-form", { recipe: null, error: "Title, ingredients, and steps are required." });
  }

  const recipe = {
    title: title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(prepTime || 0),
    steps: steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost: Number(cost || 0),
    difficulty: difficulty || "Easy",
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean)
  };

  await supabase.from("recipes").insert(recipe);

  res.redirect("/recipes");
});

app.get("/recipes/:id/edit", async (req, res) => {
  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!recipe) return res.redirect("/recipes");

  res.render("recipe-form", { recipe, error: "" });
});

app.post("/recipes/:id", async (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags } = req.body;

  const updates = {
    title: title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(prepTime || 0),
    steps: steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost: Number(cost || 0),
    difficulty: difficulty || "Easy",
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean)
  };

  await supabase.from("recipes").update(updates).eq("id", req.params.id);

  res.redirect("/recipes");
});

app.post("/recipes/:id/delete", async (req, res) => {
  await supabase.from("recipes").delete().eq("id", req.params.id);
  res.redirect("/recipes");
});

app.listen(3000, () => console.log("http://localhost:3000"));
