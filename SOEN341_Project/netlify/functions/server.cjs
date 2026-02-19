const serverless = require("serverless-http");
const express = require("express");
const path = require("path");
const { findUser, createUser, updateUser } = require("../../storage.cjs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../views"));
app.use(express.static(path.join(__dirname, "../../public")));

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


module.exports.handler = serverless(app);
