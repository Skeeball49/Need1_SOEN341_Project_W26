const serverless = require("serverless-http");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "../../users.json");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../views"));
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/", (req, res) => res.render("index.ejs"));

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

module.exports.handler = serverless(app);
