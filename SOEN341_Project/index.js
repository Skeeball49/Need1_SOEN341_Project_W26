import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "users.json");
const RECIPES_FILE = path.join(__dirname, "recipes.json");


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("index.ejs"));

const users = [
  { email: "test@test.com", password: "123456", diet: "High protein", allergies: "Peanuts" }
];
app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.render("login.ejs", { error: "No account found. Please register first." });
  }

  return res.render("dashboard.ejs", { user });
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

  const users = readUsers();
  const exists = users.find(u => u.email === email);
  if (exists) {
    return res.render("register.ejs", { error: "Account already exists. Please login." });
  }

  users.push({ email, password, diet: "", allergies: "" });
  writeUsers(users);

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

app.post("/update-profile", (req, res) => {
  const { email, diet, allergies } = req.body;

  const users = readUsers();
  const userIndex = users.findIndex(u => u.email === email);

  if (userIndex === -1) {
    return res.status(404).send("User not found");
  }

  users[userIndex].diet = diet || "";
  users[userIndex].allergies = allergies || "";
  writeUsers(users);

  return res.render("dashboard.ejs", { user: users[userIndex] });
});

app.get("/recipes", (req, res) => {
  const { q = "", maxTime = "", difficulty = "", maxCost = "", tag = "" } = req.query;

  let recipes = readRecipes();

  // SEARCH (title or ingredient)
  if (q.trim()) {
    const needle = q.toLowerCase();
    recipes = recipes.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.ingredients.join(" ").toLowerCase().includes(needle)
    );
  }

  // FILTERS
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

app.listen(3000, () => console.log("http://localhost:3000"));

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    fs.writeFileSync(USERS_FILE, "[]", "utf-8");
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

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
  return Date.now().toString(); // good enough for demo
}