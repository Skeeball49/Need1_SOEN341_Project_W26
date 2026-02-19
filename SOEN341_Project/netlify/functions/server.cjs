const serverless = require("serverless-http");
const express = require("express");
const path = require("path");
const { getUsersCollection } = require("../../db.cjs");

const app = express();

// Critical: Use raw body parser first, then URL-encoded parser
app.use(express.raw({ type: 'application/x-www-form-urlencoded' }));
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf-8');
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../../views"));
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/", (req, res) => res.render("index.ejs"));

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: "" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ email, password });

    if (!user) {
      return res.render("login.ejs", { error: "No account found. Please register first." });
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

app.post("/register", async (req, res) => {
  const { email, password, ConfirmPassword } = req.body;

  if (!email || !password || !ConfirmPassword) {
    return res.render("register.ejs", { error: "Please fill in all fields." });
  }
  if (password !== ConfirmPassword) {
    return res.render("register.ejs", { error: "Passwords do not match." });
  }

  try {
    const usersCollection = await getUsersCollection();
    const exists = await usersCollection.findOne({ email });
    if (exists) {
      return res.render("register.ejs", { error: "Account already exists. Please login." });
    }

    await usersCollection.insertOne({ email, password, diet: "", allergies: "" });
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

app.post("/update-profile", async (req, res) => {
  const { email, diet, allergies } = req.body;

  try {
    const usersCollection = await getUsersCollection();
    const result = await usersCollection.findOneAndUpdate(
      { email },
      { $set: { diet: diet || "", allergies: allergies || "" } },
      { returnDocument: 'after' }
    );

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
