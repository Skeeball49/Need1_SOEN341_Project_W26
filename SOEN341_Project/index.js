import express from "express";
import bodyParser from "body-parser";


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => res.render("index.ejs"));

const users = [
  { email: "test@test.com", password: "123456", diet: "High protein", allergies: "Peanuts" }
];
app.get("/login", (req, res) => res.render("login.ejs",{ error: "" }));
app.post("/login",(req,res)=> {
  const { email, password } = req.body;
  console.log(req.body);
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    // Account exists → go to dashboard
    res.render("dashboard.ejs", {
    user: {
      email: "demo@test.com",
      diet: "High protein",
      allergies: "None"
    }
  });
  } 
  
  else {
    // No account → go to register
    res.render("login.ejs", {
    error: "No account found. Please register first."
  });
  }
});


app.get("/register", (req, res) => res.render("register.ejs",{ error: "" }));

app.post("/register", (req, res) => {
  const { email, password, ConfirmPassword } = req.body;
  console.log(req.body);
  // basic validation
  if (!email || !password || !ConfirmPassword) {
     res.render("register.ejs", { error: "Please fill in all fields." });
  }

  if (password !== ConfirmPassword) {
     res.render("register.ejs", { error: "Passwords do not match." });
  }

  const exists = users.find(u => u.email === email);
  if (exists) {
     res.render("register.ejs", { error: "Account already exists. Please login." });
  }

  // create new user (preferences empty for now)
  users.push({
    email,
    password,
    diet: "",
    allergies: ""
  });

  // go login after successful register
  res.redirect("/login");
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

app.listen(3000, () => console.log("http://localhost:3000"));