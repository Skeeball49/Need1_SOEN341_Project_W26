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

