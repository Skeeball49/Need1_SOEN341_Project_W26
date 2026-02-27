const serverless = require("serverless-http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { findUser, createUser, updateUser } = require("../../storage.cjs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../views"));
app.use(express.static(path.join(__dirname, "../../public")));

const RECIPES_FILE = path.join(__dirname, "../../recipes.json");

// ── Recipes helpers ──

function ensureRecipesFile() {
  if (!fs.existsSync(RECIPES_FILE)) fs.writeFileSync(RECIPES_FILE, "[]", "utf-8");
}

function readRecipes() {
  ensureRecipesFile();
  try {
    return JSON.parse(fs.readFileSync(RECIPES_FILE, "utf-8") || "[]");
  } catch {
    fs.writeFileSync(RECIPES_FILE, "[]", "utf-8");
    return [];
  }
}

function writeRecipes(recipes) {
  fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2), "utf-8");
}

function newId() {
  return Date.now().toString();
}

// ── Routes ──

app.get("/", (req, res) => res.render("index.ejs"));

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  try {
    const user = findUser(email);

    if (!user || user.password !== password) {
      return res.render("login.ejs", { error: "Invalid email or password." });
    }

    return res.render("dashboard.ejs", { user });
  } catch (error) {
    console.error('Login error:', error);
    return res.render("login.ejs", { error: "An error occurred. Please try again." });
  }
});

app.get("/register", (req, res) => {
  res.render("register.ejs", { error: "" });
});

app.post("/register", (req, res) => {
  const { email, password, ConfirmPassword } = req.body;

  if (!email || !password || !ConfirmPassword) {
    return res.render("register.ejs", { error: "Please fill in all fields." });
  }
  if (password !== ConfirmPassword) {
    return res.render("register.ejs", { error: "Passwords do not match." });
  }

  try {
    const exists = findUser(email);
    if (exists) {
      return res.render("register.ejs", { error: "Account already exists. Please login." });
    }

    createUser({ email, password, diet: "", allergies: "" });
    return res.redirect("/login");
  } catch (error) {
    console.error('Registration error:', error);
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

app.post("/update-profile", (req, res) => {
  const { email, diet, allergies } = req.body;

  try {
    const result = updateUser(email, { diet: diet || "", allergies: allergies || "" });

    if (!result) {
      return res.status(404).send("User not found");
    }

    return res.render("dashboard.ejs", { user: result });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).send("An error occurred. Please try again.");
  }
});

// ── Recipe routes ──

app.get("/recipes", (req, res) => {
  const { q = "", maxTime = "", difficulty = "", maxCost = "", tag = "" } = req.query;

  let recipes = readRecipes();

  if (q.trim()) {
    const needle = q.toLowerCase();
    recipes = recipes.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.ingredients.join(" ").toLowerCase().includes(needle)
    );
  }

  if (maxTime) recipes = recipes.filter(r => Number(r.prepTime) <= Number(maxTime));
  if (difficulty) recipes = recipes.filter(r => r.difficulty === difficulty);
  if (maxCost) recipes = recipes.filter(r => Number(r.cost) <= Number(maxCost));
  if (tag.trim()) recipes = recipes.filter(r => (r.tags || []).includes(tag.trim()));

  res.render("recipes", { recipes, query: { q, maxTime, difficulty, maxCost, tag } });
});

app.get("/recipes/new", (req, res) => {
  res.render("recipe-form", { recipe: null, error: "" });
});

app.post("/recipes", (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags } = req.body;

  if (!title || !ingredients || !steps) {
    return res.render("recipe-form", { recipe: null, error: "Title, ingredients, and steps are required." });
  }

  const recipes = readRecipes();

  const recipe = {
    id: newId(),
    title: title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(prepTime || 0),
    steps: steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost: Number(cost || 0),
    difficulty: difficulty || "Easy",
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean)
  };

  recipes.push(recipe);
  writeRecipes(recipes);

  res.redirect("/recipes");
});

app.get("/recipes/:id/edit", (req, res) => {
  const recipes = readRecipes();
  const recipe = recipes.find(r => r.id === req.params.id);
  if (!recipe) return res.redirect("/recipes");

  res.render("recipe-form", { recipe, error: "" });
});

app.post("/recipes/:id", (req, res) => {
  const { title, ingredients, prepTime, steps, cost, difficulty, tags } = req.body;

  const recipes = readRecipes();
  const idx = recipes.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.redirect("/recipes");

  recipes[idx] = {
    ...recipes[idx],
    title: title.trim(),
    ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(prepTime || 0),
    steps: steps.split("\n").map(s => s.trim()).filter(Boolean),
    cost: Number(cost || 0),
    difficulty: difficulty || "Easy",
    tags: (tags || "").split(",").map(s => s.trim()).filter(Boolean)
  };

  writeRecipes(recipes);
  res.redirect("/recipes");
});

app.post("/recipes/:id/delete", (req, res) => {
  let recipes = readRecipes();
  recipes = recipes.filter(r => r.id !== req.params.id);
  writeRecipes(recipes);
  res.redirect("/recipes");
});

module.exports.handler = serverless(app, {
  binary: ["application/x-www-form-urlencoded"]
});
