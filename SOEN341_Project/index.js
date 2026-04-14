import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { findUser, createUser, updateUser } from "./storage.js";
import { supabase } from "./supabase.js";
import {
  getWeekStart,
  generateRecipeCode,
  parseIngredient,
  categorizeIngredient,
  consolidateIngredients,
  calculateMatchPercentage,
  calculateDailyBreakdown,
  calculateWeeklyStats,
  buildRecipeObject,
  scaleIngredient,
  validateRegistration,
  normalizeIngredientName,
} from "./utils.js";

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

  const validation = validateRegistration(email, password, ConfirmPassword);
  if (!validation.valid) {
    return res.render("register.ejs", { error: validation.error });
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
  const { title, ingredients, steps } = req.body;

  if (!title || !ingredients || !steps) {
    return res.render("recipe-form", { recipe: null, error: "Title, ingredients, and steps are required." });
  }

  const recipe = buildRecipeObject(req.body);
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
  const updates = buildRecipeObject(req.body);
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

  // Generate a unique code for each recipe
  const recipesWithCode = (recipes || []).map(r => ({
    ...r,
    code: generateRecipeCode(r.title, r.id)
  }));

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
    recipes: recipesWithCode,
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

  // Get recipe details first for code generation
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("id", recipe_id)
    .single();

  if (!recipe) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=Recipe+not+found`);
  }

  const recipeCode = generateRecipeCode(recipe.title, recipe.id);

  // WP-5: Prevent duplicate recipe in the exact same day+meal_type slot
  const { data: exactDuplicate } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_email", email)
    .eq("week_start", weekStart)
    .eq("day", day)
    .eq("meal_type", meal_type)
    .eq("recipe_id", recipe_id);

  if (exactDuplicate && exactDuplicate.length > 0) {
    return res.redirect(
      `/planner?email=${encodeURIComponent(email)}&error=Duplicate+detected!+Recipe+${encodeURIComponent(recipeCode)}+is+already+in+${encodeURIComponent(day)}+${encodeURIComponent(meal_type)}`
    );
  }

  await supabase.from("meal_plans").insert({
    user_email: email,
    week_start: weekStart,
    day,
    meal_type,
    recipe_id,
    recipe_title: recipe.title,
  });

  res.redirect(`/planner?email=${encodeURIComponent(email)}&success=Meal+added+(${encodeURIComponent(recipeCode)})`);
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
    return res.render("grocery", {
      user,
      groceryList: [],
      groupedList: {},
      weekStart,
      totalCost: 0,
      hasPlannedMeals: false,
    });
  }

  const recipeIds = [...new Set(planEntries.map((e) => e.recipe_id))];
  const [{ data: recipes }, { data: pantryItems }] = await Promise.all([
    supabase.from("recipes").select("*").in("id", recipeIds),
    supabase.from("pantry_items").select("*").eq("user_email", email),
  ]);

  const recipeMap = {};
  for (const recipe of recipes || []) {
    recipeMap[String(recipe.id)] = recipe;
  }

  const plannedRecipes = (planEntries || [])
    .map((entry) => recipeMap[String(entry.recipe_id)])
    .filter(Boolean);

  const { groceryList, totalCost } = consolidateIngredients(plannedRecipes, pantryItems || []);

  // Group by category
  const groupedList = {};
  for (const item of groceryList) {
    if (!groupedList[item.category]) groupedList[item.category] = [];
    groupedList[item.category].push(item);
  }

  res.render("grocery", {
    user,
    groceryList,
    groupedList,
    weekStart,
    totalCost,
    hasPlannedMeals: true,
  });
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

  const normalizedName = normalizeIngredientName(ingredient_name);
  const quantityNumber = Number(quantity || 1);

  if (!normalizedName) {
    return res.redirect(`/pantry?email=${encodeURIComponent(email)}&error=Ingredient+name+is+required`);
  }
  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
    return res.redirect(`/pantry?email=${encodeURIComponent(email)}&error=Quantity+must+be+greater+than+0`);
  }

  // Check if item already exists
  const { data: existing } = await supabase
    .from("pantry_items")
    .select("id, quantity")
    .eq("user_email", email)
    .eq("ingredient_name", normalizedName)
    .single();

  if (existing) {
    // Update existing quantity
    const newQty = Number(existing.quantity || 0) + quantityNumber;
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
      quantity: quantityNumber,
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
  const quantityNumber = Number(quantity);

  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
    return res.redirect(`/pantry?email=${encodeURIComponent(email)}&error=Quantity+must+be+greater+than+0`);
  }

  await supabase
    .from("pantry_items")
    .update({ quantity: quantityNumber })
    .eq("id", item_id)
    .eq("user_email", email);

  res.redirect(`/pantry?email=${encodeURIComponent(email)}&success=Quantity+updated`);
});

// ---- Recipe Recommendations ----

app.get("/recommendations", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  // Get user's pantry items
  const { data: pantryItems } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_email", email);

  const pantryIngredients = (pantryItems || [])
    .map(item => normalizeIngredientName(item.ingredient_name))
    .filter(Boolean);

  // Get all recipes
  const { data: allRecipes } = await supabase.from("recipes").select("*");

  // Calculate match percentage for each recipe
  const recipesWithMatch = (allRecipes || []).map(recipe => {
    const recipeIngredients = (recipe.ingredients || []).map(ing => parseIngredient(ing).name);
    const matchPercentage = calculateMatchPercentage(recipe, pantryIngredients);
    const matchedCount = recipeIngredients.filter(ing =>
      pantryIngredients.some(p => ing.includes(p) || p.includes(ing))
    ).length;

    return {
      ...recipe,
      matchPercentage,
      matchedCount,
      totalIngredients: recipeIngredients.length,
      missingCount: recipeIngredients.length - matchedCount,
    };
  });

  // Sort by match percentage (highest first)
  const recommendations = recipesWithMatch
    .filter(r => r.matchPercentage > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  res.render("recommendations", { user, recommendations, pantryCount: pantryIngredients.length });
});

// ---- Meal Plan Templates ----

app.get("/templates", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  // Get user's templates and public templates
  const { data: templates } = await supabase
    .from("meal_plan_templates")
    .select("*")
    .or(`created_by.eq.${email},is_public.eq.true`)
    .order("created_date", { ascending: false });

  res.render("templates", { user, templates: templates || [] });
});

app.post("/templates/save", async (req, res) => {
  const { email, template_name, description, category, is_public } = req.body;
  if (!email || !template_name) {
    return res.redirect(`/templates?email=${encodeURIComponent(email)}&error=Template+name+required`);
  }

  const weekStart = getWeekStart();

  // Get current week's meal plan
  const { data: planEntries } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_email", email)
    .eq("week_start", weekStart);

  if (!planEntries || planEntries.length === 0) {
    return res.redirect(`/templates?email=${encodeURIComponent(email)}&error=No+meals+planned+this+week`);
  }

  // Create template
  const { data: template } = await supabase
    .from("meal_plan_templates")
    .insert({
      template_name: template_name.trim(),
      description: description || "",
      created_by: email,
      is_public: is_public === "on",
      category: category || "Custom"
    })
    .select()
    .single();

  // Add template entries
  const entries = planEntries.map(entry => ({
    template_id: template.id,
    day: entry.day,
    meal_type: entry.meal_type,
    recipe_id: entry.recipe_id,
    recipe_title: entry.recipe_title
  }));

  await supabase.from("template_entries").insert(entries);

  res.redirect(`/templates?email=${encodeURIComponent(email)}&success=Template+saved`);
});

app.post("/templates/load", async (req, res) => {
  const { email, template_id } = req.body;
  if (!email || !template_id) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=Invalid+template`);
  }

  const weekStart = getWeekStart();

  // Get template entries
  const { data: entries } = await supabase
    .from("template_entries")
    .select("*")
    .eq("template_id", template_id);

  if (!entries || entries.length === 0) {
    return res.redirect(`/planner?email=${encodeURIComponent(email)}&error=Template+is+empty`);
  }

  // Clear current week's plan
  await supabase
    .from("meal_plans")
    .delete()
    .eq("user_email", email)
    .eq("week_start", weekStart);

  // Load template into current week
  const newEntries = entries.map(entry => ({
    user_email: email,
    week_start: weekStart,
    day: entry.day,
    meal_type: entry.meal_type,
    recipe_id: entry.recipe_id,
    recipe_title: entry.recipe_title
  }));

  await supabase.from("meal_plans").insert(newEntries);

  res.redirect(`/planner?email=${encodeURIComponent(email)}&success=Template+loaded`);
});

app.post("/templates/delete", async (req, res) => {
  const { email, template_id } = req.body;
  await supabase
    .from("meal_plan_templates")
    .delete()
    .eq("id", template_id)
    .eq("created_by", email);
  res.redirect(`/templates?email=${encodeURIComponent(email)}&success=Template+deleted`);
});

// ---- Nutritional Tracking ----

app.get("/nutrition", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const weekStart = getWeekStart();

  // Get user's goals
  let { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_email", email)
    .single();

  if (!goals) {
    // Create default goals
    await supabase.from("user_goals").insert({
      user_email: email,
      daily_calories: 2000,
      daily_protein: 50,
      daily_carbs: 250,
      daily_fat: 70,
      weekly_budget: 100
    });
    goals = { daily_calories: 2000, daily_protein: 50, daily_carbs: 250, daily_fat: 70, weekly_budget: 100 };
  }

  // Get this week's meal plan
  const { data: planEntries } = await supabase
    .from("meal_plans")
    .select("recipe_id, day, meal_type")
    .eq("user_email", email)
    .eq("week_start", weekStart);

  if (!planEntries || planEntries.length === 0) {
    return res.render("nutrition", { user, goals, weeklyStats: null, dailyBreakdown: [], weekStart });
  }

  const recipeIds = [...new Set(planEntries.map(e => e.recipe_id))];
  const { data: recipes } = await supabase.from("recipes").select("*").in("id", recipeIds);

  const recipeMap = {};
  for (const recipe of recipes || []) {
    recipeMap[recipe.id] = recipe;
  }

  const dailyBreakdown = calculateDailyBreakdown(planEntries, recipeMap, DAYS);
  const weeklyStats    = calculateWeeklyStats(dailyBreakdown);

  res.render("nutrition", { user, goals, weeklyStats, dailyBreakdown, weekStart });
});

app.post("/nutrition/goals", async (req, res) => {
  const { email, daily_calories, daily_protein, daily_carbs, daily_fat, weekly_budget } = req.body;
  
  await supabase
    .from("user_goals")
    .upsert({
      user_email: email,
      daily_calories: Number(daily_calories || 2000),
      daily_protein: Number(daily_protein || 50),
      daily_carbs: Number(daily_carbs || 250),
      daily_fat: Number(daily_fat || 70),
      weekly_budget: Number(weekly_budget || 100)
    }, { onConflict: "user_email" });

  res.redirect(`/nutrition?email=${encodeURIComponent(email)}&success=Goals+updated`);
});

// ---- Budget Tracking ----

app.get("/budget", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  const weekStart = getWeekStart();

  // Get user's budget goal
  let { data: goals } = await supabase
    .from("user_goals")
    .select("weekly_budget")
    .eq("user_email", email)
    .single();

  const weeklyBudgetGoal = goals?.weekly_budget || 100;

  // Get current week's planned cost
  const { data: planEntries } = await supabase
    .from("meal_plans")
    .select("recipe_id")
    .eq("user_email", email)
    .eq("week_start", weekStart);

  let plannedCost = 0;
  if (planEntries && planEntries.length > 0) {
    const recipeIds = [...new Set(planEntries.map(e => e.recipe_id))];
    const { data: recipes } = await supabase.from("recipes").select("cost").in("id", recipeIds);
    plannedCost = (recipes || []).reduce((sum, r) => sum + Number(r.cost || 0), 0);
  }

  // Get or create budget tracking entry
  let { data: budgetEntry } = await supabase
    .from("budget_tracking")
    .select("*")
    .eq("user_email", email)
    .eq("week_start", weekStart)
    .single();

  if (!budgetEntry) {
    await supabase.from("budget_tracking").insert({
      user_email: email,
      week_start: weekStart,
      planned_budget: weeklyBudgetGoal,
      actual_spent: 0
    });
    budgetEntry = { planned_budget: weeklyBudgetGoal, actual_spent: 0, notes: "" };
  }

  // Get past 8 weeks for trend
  const { data: history } = await supabase
    .from("budget_tracking")
    .select("*")
    .eq("user_email", email)
    .order("week_start", { ascending: false })
    .limit(8);

  res.render("budget", { 
    user, 
    weekStart, 
    budgetEntry, 
    plannedCost, 
    weeklyBudgetGoal,
    history: (history || []).reverse()
  });
});

app.post("/budget/update", async (req, res) => {
  const { email, actual_spent, notes } = req.body;
  const weekStart = getWeekStart();

  await supabase
    .from("budget_tracking")
    .update({
      actual_spent: Number(actual_spent || 0),
      notes: notes || ""
    })
    .eq("user_email", email)
    .eq("week_start", weekStart);

  res.redirect(`/budget?email=${encodeURIComponent(email)}&success=Budget+updated`);
});

// ---- Recipe Scaling ----

app.get("/recipes/:id/scale", async (req, res) => {
  const { servings } = req.query;
  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (!recipe) return res.status(404).send("Recipe not found");

  const originalServings = recipe.servings || 4;
  const newServings = Number(servings) || originalServings;
  const scale = newServings / originalServings;

  const scaledRecipe = {
    ...recipe,
    servings: newServings,
    ingredients: recipe.ingredients.map(ing => scaleIngredient(ing, scale)),
    calories: Math.round(recipe.calories * scale),
    protein: (recipe.protein * scale).toFixed(1),
    carbs:   (recipe.carbs   * scale).toFixed(1),
    fat:     (recipe.fat     * scale).toFixed(1),
    cost:    (recipe.cost    * scale).toFixed(2),
  };

  res.json(scaledRecipe);
});

// ---- Profile ----

app.get("/profile", async (req, res) => {
  const { email, success = "", error = "" } = req.query;
  if (!email) return res.redirect("/login");

  const user = await findUser(email);
  if (!user) return res.redirect("/login");

  let { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_email", email)
    .single();
  if (!goals) goals = { daily_calories: 2000, daily_protein: 50, daily_carbs: 250, daily_fat: 70, weekly_budget: 100 };

  const weekStart = getWeekStart();

  const [pantryRes, mealsRes, recipesRes] = await Promise.all([
    supabase.from("pantry_items").select("*", { count: "exact", head: true }).eq("user_email", email),
    supabase.from("meal_plans").select("*", { count: "exact", head: true }).eq("user_email", email).eq("week_start", weekStart),
    supabase.from("recipes").select("*", { count: "exact", head: true })
  ]);

  res.render("profile", {
    user,
    goals,
    pantryCount: pantryRes.count || 0,
    mealsCount: mealsRes.count || 0,
    recipesCount: recipesRes.count || 0,
    success,
    error
  });
});

app.get("/logout", (_req, res) => res.redirect("/login"));

app.post("/change-password", async (req, res) => {
  const { email, current_password, new_password, confirm_password } = req.body;
  const user = await findUser(email);
  if (!user || user.password !== current_password) {
    return res.redirect(`/profile?email=${encodeURIComponent(email)}&error=Current+password+is+incorrect`);
  }
  if (!new_password || new_password !== confirm_password) {
    return res.redirect(`/profile?email=${encodeURIComponent(email)}&error=New+passwords+do+not+match`);
  }
  await updateUser(email, { password: new_password });
  res.redirect(`/profile?email=${encodeURIComponent(email)}&success=Password+updated`);
});

app.post("/delete-account", async (req, res) => {
  const { email, confirm_email } = req.body;
  if (!email || email !== confirm_email) {
    return res.redirect(`/profile?email=${encodeURIComponent(email)}&error=Email+confirmation+did+not+match`);
  }
  const { data: templates } = await supabase.from("meal_plan_templates").select("id").eq("created_by", email);
  const templateIds = (templates || []).map(t => t.id);
  if (templateIds.length > 0) {
    await supabase.from("template_entries").delete().in("template_id", templateIds);
  }
  await supabase.from("meal_plans").delete().eq("user_email", email);
  await supabase.from("pantry_items").delete().eq("user_email", email);
  await supabase.from("user_goals").delete().eq("user_email", email);
  await supabase.from("budget_tracking").delete().eq("user_email", email);
  await supabase.from("meal_plan_templates").delete().eq("created_by", email);
  await supabase.from("users").delete().eq("email", email);
  res.redirect("/login");
});

app.listen(3000, async () => {
  console.log("http://localhost:3000");

  // Verify meal_plans table exists; warn if not yet created in Supabase
  const { error } = await supabase.from("meal_plans").select("id").limit(1);
  if (error) {
    console.warn(
      "\n[MealMajor] WARNING: 'meal_plans' table not found in Supabase.\n" +
      "Run schema.sql in your Supabase SQL Editor to create it.\n"
    );
  }
});
