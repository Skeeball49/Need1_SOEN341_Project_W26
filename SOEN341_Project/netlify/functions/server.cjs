const serverless = require("serverless-http");
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || "https://enxoxjoeqvlxqnfpmpim.supabase.co",
  process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueG94am9lcXZseHFuZnBtcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM0ODksImV4cCI6MjA4NzUyOTQ4OX0.31he6qAZCmo6z8niggBxzQXMjAPi3n8wGqxS5Z_63YM"
);

const querystring = require("querystring");

const app = express();

// Netlify passes the body as a Buffer — parse it manually
app.use((req, res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      req.body = querystring.parse(req.body.toString("utf-8"));
    } else if (contentType.includes("application/json")) {
      req.body = JSON.parse(req.body.toString("utf-8"));
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../views"));
app.use(express.static(path.join(__dirname, "../../public")));

// ── User helpers (Supabase) ──

async function findUser(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  if (error) return null;
  return data;
}

async function createUser(userData) {
  const { error } = await supabase.from("users").insert(userData);
  if (error) {
    console.error("[createUser] Supabase error:", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

async function updateUser(email, updates) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("email", email)
    .select()
    .single();
  if (error) return null;
  return data;
}

// ── Routes ──

app.get("/", (req, res) => res.render("index.ejs"));

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUser(email);

    if (!user || user.password !== password) {
      return res.render("login.ejs", { error: "Invalid email or password." });
    }

    return res.render("dashboard.ejs", { user });
  } catch (error) {
    console.error("Login error:", error);
    return res.render("login.ejs", { error: "An error occurred. Please try again." });
  }
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

  try {
    const exists = await findUser(email);
    if (exists) {
      return res.render("register.ejs", { error: "Account already exists. Please login." });
    }

    const result = await createUser({ email, password, diet: "", allergies: "" });
    if (!result.ok) {
      return res.render("register.ejs", { error: "Could not create account: " + result.message });
    }
    return res.redirect("/login");
  } catch (error) {
    console.error("Registration error:", error);
    return res.render("register.ejs", { error: "An error occurred. Please try again." });
  }
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

  try {
    const user = await updateUser(email, { diet: diet || "", allergies: allergies || "" });

    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.render("dashboard.ejs", { user });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).send("An error occurred. Please try again.");
  }
});

// ── Recipe routes (Supabase) ──

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
  if (q.trim() && filtered.length === 0) {
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

// ── Sprint 3: Weekly Meal Planner ──

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// WP-1 / WP-2: View weekly planner grid
app.get("/planner", async (req, res) => {
  const { email, error = "", success = "" } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const weekStart = getWeekStart();

  const { data: planEntries } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_email", email)
    .eq("week_start", weekStart);

  const { data: recipes } = await supabase.from("recipes").select("id, title");

  const grid = {};
  for (const d of DAYS) {
    grid[d] = {};
    for (const mt of MEAL_TYPES) grid[d][mt] = [];
  }
  for (const entry of planEntries || []) {
    if (grid[entry.day] && grid[entry.day][entry.meal_type]) {
      grid[entry.day][entry.meal_type].push(entry);
    }
  }

  res.render("planner", { user, grid, days: DAYS, mealTypes: MEAL_TYPES, recipes: recipes || [], weekStart, error, success });
});

// WP-3: Assign recipe to day/meal-type slot
app.post("/planner/add", async (req, res) => {
  const { email, day, meal_type, recipe_id } = req.body;
  if (!email || !day || !meal_type || !recipe_id) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=Please+fill+in+all+fields`);
  }

  const weekStart = getWeekStart();

  // WP-5: Prevent duplicate in the same week/day/meal-type slot
  const { data: existing } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_email", email)
    .eq("week_start", weekStart)
    .eq("day", day)
    .eq("meal_type", meal_type)
    .eq("recipe_id", recipe_id);

  if (existing && existing.length > 0) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=That+recipe+is+already+planned+for+this+slot`);
  }

  const { data: recipe } = await supabase.from("recipes").select("title").eq("id", recipe_id).single();

  await supabase.from("meal_plans").insert({
    user_email: email,
    week_start: weekStart,
    day,
    meal_type,
    recipe_id,
    recipe_title: recipe ? recipe.title : "Unknown",
  });

  res.redirect(`/planner?email=${encodeURIComponent(email)}&success=Meal+added`);
});

// WP-4: Remove a meal from the planner
app.post("/planner/remove", async (req, res) => {
  const { email, entry_id } = req.body;
  await supabase.from("meal_plans").delete().eq("id", entry_id).eq("user_email", email);
  res.redirect(`/planner?email=${encodeURIComponent(email)}`);
});

// ── Unique Feature: Smart Grocery List ──

app.get("/grocery", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const weekStart = getWeekStart();

  const { data: planEntries } = await supabase
    .from("meal_plans")
    .select("recipe_id")
    .eq("user_email", email)
    .eq("week_start", weekStart);

  if (!planEntries || planEntries.length === 0) {
    return res.render("grocery", { user, groceryList: [], weekStart, totalCost: 0 });
  }

  const recipeIds = [...new Set(planEntries.map((e) => e.recipe_id))];
  const { data: recipes } = await supabase.from("recipes").select("*").in("id", recipeIds);

  const ingredientMap = {};
  let totalCost = 0;

  for (const recipe of recipes || []) {
    totalCost += Number(recipe.cost || 0);
    for (const raw of recipe.ingredients || []) {
      const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (match) {
        const qty = parseFloat(match[1]);
        const name = match[2].toLowerCase().trim();
        ingredientMap[name] = (ingredientMap[name] || 0) + qty;
      } else {
        const name = raw.toLowerCase().trim();
        ingredientMap[name] = (ingredientMap[name] || 0) + 1;
      }
    }
  }

  const groceryList = Object.entries(ingredientMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.render("grocery", { user, groceryList, weekStart, totalCost });
});

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Netlify sends form bodies as base64 — decode before passing to Express
  if (event.isBase64Encoded && event.body) {
    event.body = Buffer.from(event.body, "base64").toString("utf-8");
    event.isBase64Encoded = false;
  }
  return handler(event, context);
};
