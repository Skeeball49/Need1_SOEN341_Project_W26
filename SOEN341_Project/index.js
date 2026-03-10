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

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await findUser(email);

  if (!user || user.password !== password) {
    return res.render("login.ejs", { error: "No account found. Please register first." });
  }

  // New users (no diet set) go through onboarding first
  if (!user.diet || user.diet === "") {
    return res.redirect(`/onboarding?email=${encodeURIComponent(email)}`);
  }
  return res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
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

  const result = await createUser({ email, password, diet: "", allergies: "" });

  if (!result.ok) {
    return res.render("register.ejs", {
      error: "Could not create account: " + result.message,
    });
  }

  return res.redirect("/login");
});

// Onboarding — collect diet/allergy prefs after first login
app.get("/onboarding", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");
  const user = await findUser(email);
  if (!user) return res.redirect("/login");
  res.render("onboarding", { user });
});

app.post("/onboarding", async (req, res) => {
  const { email, diet, allergies } = req.body;
  await updateUser(email, {
    diet: diet || "No Preference",
    allergies: allergies || ""
  });
  res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
});

app.get("/dashboard", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const weekStart = getWeekStart();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[new Date().getDay()];

  // Fetch today's planned meals
  const { data: todayEntries } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_email", email)
    .eq("week_start", weekStart)
    .eq("day", todayName);

  const todayMeals = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
  if (todayEntries && todayEntries.length > 0) {
    const ids = [...new Set(todayEntries.map(e => e.recipe_id))];
    const { data: recipes } = await supabase
      .from("recipes")
      .select("id, title, calories, prepTime, category")
      .in("id", ids);
    const recipeMap = {};
    for (const r of recipes || []) recipeMap[r.id] = r;
    for (const entry of todayEntries) {
      const mt = entry.meal_type;
      if (todayMeals[mt]) {
        todayMeals[mt].push({ ...entry, recipe: recipeMap[entry.recipe_id] || null });
      }
    }
  }

  const todayCalories = Object.values(todayMeals)
    .flat()
    .reduce((sum, m) => sum + Number(m.recipe?.calories || 0), 0);

  let { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_email", email)
    .single();
  if (!goals) goals = { daily_calories: 2000, daily_protein: 50, daily_carbs: 250, daily_fat: 70, weekly_budget: 100 };

  const calorieRingPct = goals.daily_calories > 0
    ? Math.min(100, Math.round((todayCalories / goals.daily_calories) * 100))
    : 0;
  const ringCircumference = 314;
  const ringOffset = Math.round(ringCircumference - (calorieRingPct / 100) * ringCircumference);

  res.render("dashboard", { user, todayMeals, todayName, todayCalories, goals, calorieRingPct, ringOffset });
});

app.post("/update-profile", async (req, res) => {
  const { email, diet, allergies } = req.body;

  const user = await updateUser(email, { diet: diet || "", allergies: allergies || "" });

  if (!user) {
    return res.redirect(`/profile?email=${encodeURIComponent(email)}&error=User+not+found`);
  }

  return res.redirect(`/profile?email=${encodeURIComponent(email)}&success=Preferences+updated`);
});

// RM-5 Search and filter recipes
app.get("/recipes", async (req, res) => {
  const { q = "", maxTime = "", difficulty = "", maxCost = "", tag = "", email = "" } = req.query;

  const user = email ? await findUser(email) : null;

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

  res.render("recipes", { recipes: filtered, query: { q, maxTime, difficulty, maxCost, tag }, user });
});

app.get("/recipes/new", async (req, res) => {
  const { email = "" } = req.query;
  const user = email ? await findUser(email) : null;
  res.render("recipe-form", { recipe: null, error: "", user });
});

app.post("/recipes", async (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags, servings, calories, protein, carbs, fat, category } = req.body;

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
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean),
    servings: Number(servings || 4),
    calories: Number(calories || 0),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fat: Number(fat || 0),
    category: category || "Main Course"
  };

  await supabase.from("recipes").insert(recipe);

  const { email = "" } = req.body;
  res.redirect(`/recipes${email ? `?email=${encodeURIComponent(email)}` : ""}`);
});

// RM-3 Edit recipes
app.get("/recipes/:id/edit", async (req, res) => {
  const { email = "" } = req.query;
  const user = email ? await findUser(email) : null;

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!recipe) return res.redirect(`/recipes${email ? `?email=${encodeURIComponent(email)}` : ""}`);

  res.render("recipe-form", { recipe, error: "", user });
});

app.post("/recipes/:id", async (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags, servings, calories, protein, carbs, fat, category } = req.body;

  const updates = {
    title: title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(prepTime || 0),
    steps: steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost: Number(cost || 0),
    difficulty: difficulty || "Easy",
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean),
    servings: Number(servings || 4),
    calories: Number(calories || 0),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fat: Number(fat || 0),
    category: category || "Main Course"
  };

  await supabase.from("recipes").update(updates).eq("id", req.params.id);

  const { email = "" } = req.body;
  res.redirect(`/recipes${email ? `?email=${encodeURIComponent(email)}` : ""}`);
});

// RM-4 Delete recipes
app.post("/recipes/:id/delete", async (req, res) => {
  const { email = "" } = req.body;
  await supabase.from("recipes").delete().eq("id", req.params.id);
  res.redirect(`/recipes${email ? `?email=${encodeURIComponent(email)}` : ""}`);
});

// ---- Sprint 3: Weekly Meal Planner ----

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

// Returns the ISO date string (YYYY-MM-DD) for the Monday of the current week
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// WP-1 / WP-2: View weekly meal planner grid
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

  // Build grid: { Day: { MealType: [entries] } }
  const grid = {};
  for (const day of DAYS) {
    grid[day] = {};
    for (const mt of MEAL_TYPES) {
      grid[day][mt] = [];
    }
  }
  for (const entry of planEntries || []) {
    if (grid[entry.day]?.[entry.meal_type]) {
      grid[entry.day][entry.meal_type].push(entry);
    }
  }

  res.render("planner", {
    user,
    grid,
    days: DAYS,
    mealTypes: MEAL_TYPES,
    recipes: recipes || [],
    weekStart,
    error,
    success,
  });
});

// WP-3: Assign a recipe to a day/meal-type slot
app.post("/planner/add", async (req, res) => {
  const { email, day, meal_type, recipe_id } = req.body;
  if (!email || !day || !meal_type || !recipe_id) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=Please+fill+in+all+fields`);
  }

  const weekStart = getWeekStart();

  // WP-5: Prevent duplicate recipe in the same week/day/meal-type slot
  const { data: existing } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_email", email)
    .eq("week_start", weekStart)
    .eq("day", day)
    .eq("meal_type", meal_type)
    .eq("recipe_id", recipe_id);

  if (existing && existing.length > 0) {
    return res.redirect(
      `/planner?email=${encodeURIComponent(email)}&error=That+recipe+is+already+planned+for+this+slot`
    );
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("title")
    .eq("id", recipe_id)
    .single();

  await supabase.from("meal_plans").insert({
    user_email: email,
    week_start: weekStart,
    day,
    meal_type,
    recipe_id: Number(recipe_id),
    recipe_title: recipe?.title || "Unknown",
  });

  res.redirect(`/planner?email=${encodeURIComponent(email)}&success=Meal+added`);
});

// WP-4: Remove a meal entry from the planner
app.post("/planner/remove", async (req, res) => {
  const { email, entry_id } = req.body;
  await supabase.from("meal_plans").delete().eq("id", entry_id).eq("user_email", email);
  res.redirect(`/planner?email=${encodeURIComponent(email)}`);
});

// ---- Sprint 3 Unique Feature: Smart Grocery List Generation ----

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

  // Get user's pantry items
  const { data: pantryItems } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_email", email);

  const pantryMap = {};
  for (const item of pantryItems || []) {
    pantryMap[item.ingredient_name.toLowerCase().trim()] = Number(item.quantity || 0);
  }

  // Consolidate ingredients: parse leading numbers and sum quantities
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

  // Subtract pantry quantities and filter out items we already have
  const groceryList = Object.entries(ingredientMap)
    .map(([name, needed]) => {
      const inPantry = pantryMap[name] || 0;
      const toBuy = Math.max(0, needed - inPantry);
      
      // Try to match category from pantry items
      let category = "Other";
      const pantryItem = (pantryItems || []).find(p => p.ingredient_name.toLowerCase() === name);
      if (pantryItem && pantryItem.category) {
        category = pantryItem.category;
      } else {
        // Auto-categorize common items
        if (name.includes("milk") || name.includes("cheese") || name.includes("yogurt") || name.includes("butter")) category = "Dairy";
        else if (name.includes("chicken") || name.includes("beef") || name.includes("pork") || name.includes("fish")) category = "Meat";
        else if (name.includes("apple") || name.includes("banana") || name.includes("lettuce") || name.includes("tomato")) category = "Produce";
        else if (name.includes("rice") || name.includes("pasta") || name.includes("bread") || name.includes("flour")) category = "Grains";
      }
      
      return { name, needed, inPantry, toBuy, category };
    })
    .filter(item => item.toBuy > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group by category
  const groupedList = {};
  for (const item of groceryList) {
    if (!groupedList[item.category]) groupedList[item.category] = [];
    groupedList[item.category].push(item);
  }

  res.render("grocery", { user, groceryList, groupedList, weekStart, totalCost });
});

// ---- Pantry Management ----

app.get("/pantry", async (req, res) => {
  const { email, error = "", success = "" } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const { data: pantryItems } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_email", email)
    .order("ingredient_name");

  res.render("pantry", { user, pantryItems: pantryItems || [], error, success });
});

app.post("/pantry/add", async (req, res) => {
  const { email, ingredient_name, quantity, unit, expiration_date, category } = req.body;
  if (!email || !ingredient_name) {
    return res.redirect(`/pantry?email=${encodeURIComponent(email)}&error=Ingredient+name+is+required`);
  }

  const normalizedName = ingredient_name.toLowerCase().trim();

  // Check if item already exists
  const { data: existing } = await supabase
    .from("pantry_items")
    .select("id, quantity")
    .eq("user_email", email)
    .eq("ingredient_name", normalizedName)
    .single();

  if (existing) {
    // Update existing quantity
    const newQty = Number(existing.quantity || 0) + Number(quantity || 1);
    await supabase
      .from("pantry_items")
      .update({ 
        quantity: newQty, 
        unit: unit || "",
        expiration_date: expiration_date || null,
        category: category || "Other"
      })
      .eq("id", existing.id);
  } else {
    // Insert new item
    await supabase.from("pantry_items").insert({
      user_email: email,
      ingredient_name: normalizedName,
      quantity: Number(quantity || 1),
      unit: unit || "",
      expiration_date: expiration_date || null,
      category: category || "Other"
    });
  }

  res.redirect(`/pantry?email=${encodeURIComponent(email)}&success=Item+added`);
});

app.post("/pantry/remove", async (req, res) => {
  const { email, item_id } = req.body;
  await supabase.from("pantry_items").delete().eq("id", item_id).eq("user_email", email);
  res.redirect(`/pantry?email=${encodeURIComponent(email)}&success=Item+removed`);
});

app.post("/pantry/update", async (req, res) => {
  const { email, item_id, quantity } = req.body;
  if (quantity && Number(quantity) > 0) {
    await supabase
      .from("pantry_items")
      .update({ quantity: Number(quantity) })
      .eq("id", item_id)
      .eq("user_email", email);
  }
  res.redirect(`/pantry?email=${encodeURIComponent(email)}&success=Quantity+updated`);
});

