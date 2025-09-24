// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// server.js 

// The design is meant to set up to have express server 
// with sessions, as well as having a simple login/logout API.
import 'dotenv/config';
import express from "express";
import helmet from "helmet";          // security headers
import morgan from "morgan";          // request logging
import session from "express-session"; // session middleware
import path from "path";
import { fileURLToPath } from "url";

// MongoDB driver
import { MongoClient } from "mongodb";  

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mongo connection config/handles
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017"; 
const DB_NAME = process.env.DB_NAME || "workout_app";                        
let db, Users, Workouts;   

// Middleware
app.use(helmet()); // Purpose is to add common security headers
app.use(morgan("dev")); // Now we can have it where it logs requests to console
app.use(express.urlencoded({ extended: false }));  
app.use(express.json());                           
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "super-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                   // prevent JS from reading cookie
    sameSite: "lax",                  // helps protect against CSRF
    secure: process.env.NODE_ENV === "production" // only send cookie over HTTPS in prod
  }
}));


app.get("/status", (req, res) => res.json({ ok: true }));

// Return session user info (used by main.js)
app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null, firstLogin: req.session.firstLogin || false });
  // To make sure that we reset "firstLogin" after showing banner once
  req.session.firstLogin = false;
});

// Small helper to detect fetch/XHR vs normal form post
function wantsJSON(req) {
  return req.headers["x-requested-with"] === "XMLHttpRequest" ||
         (req.headers.accept || "").includes("application/json");
}

// Simple auth guard for protected APIs
function ensureAuth(req, res, next) {                                     
    if (req.session?.user?.username) return next();                         
    return res.status(401).json({ error: "Not authenticated" });            
}

app.post("/login", async (req, res) => {   
  const username = (req.body?.username ?? "").trim();
  if (!username) {
    if (wantsJSON(req)) return res.status(400).json({ error: "Username required" });
    return res.redirect("/");
  }

  let firstTime = false;  
  try {
    const up = await Users.updateOne(
      { username },
      { $setOnInsert: { username, createdAt: new Date() } },
      { upsert: true }
    );
    firstTime = up.upsertedCount > 0;
  } catch (e) {
    console.error("User upsert failed:", e);
  }

  req.session.user = { username };
  req.session.firstLogin = firstTime;

  if (wantsJSON(req)) return res.json({ ok: true });
  return res.redirect("/");
});

// Logout, so that we are now able to clear the session
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    if (wantsJSON(req)) return res.json({ ok: true });
    return res.redirect("/");
  });
});

// This prevents console errors from main.js (initWorkoutsUI)
// Now we have it to where for Results endpoint — all workouts for the logged-in user
// READ: all workouts for the logged-in user
app.get("/api/workouts", ensureAuth, async (req, res) => {
  try {
    if (!Workouts) return res.status(503).json({ error: "Database not ready" }); // <---

    const username = req.session.user.username;
    const docs = await Workouts.find({ username })
      .sort({ createdAt: 1 })
      .project({ username: 0 })
      .toArray();
    res.json(docs);
  } catch (e) {
    console.error("GET /api/workouts failed:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE: add a workout for the logged-in user
app.post("/api/workouts", ensureAuth, async (req, res) => {
  try {
    const username = req.session.user.username;
    const { exercise, sets, reps, weight } = req.body ?? {};

    const validText = (s) => typeof s === "string" && s.trim().length >= 2 && /[a-z]/i.test(s);
    const nonNegNum = (n) => Number.isFinite(Number(n)) && Number(n) >= 0;

    if (!validText(exercise) || !nonNegNum(sets) || !nonNegNum(reps) || !nonNegNum(weight)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const s = Number(sets), r = Number(reps), w = Number(weight);
    const allZero = (s === 0 && r === 0 && w === 0);
    const volume = allZero ? null : s * r * w;

    await Workouts.insertOne({
      username,
      exercise: exercise.trim(),
      sets: s, reps: r, weight: w,
      volume,
      createdAt: new Date()
    });

    const docs = await Workouts.find({ username })
      .sort({ createdAt: 1 })
      .project({ username: 0 })
      .toArray();
    res.json(docs);
  } catch (e) {
    console.error("POST /api/workouts failed:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/update", ensureAuth, async (req, res) => {
  try {
    const username = req.session.user.username;
    const { index, exercise, sets, reps, weight } = req.body ?? {};
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const validText = (s) => typeof s === "string" && s.trim().length >= 2 && /[a-z]/i.test(s);
    const nonNegNum = (n) => Number.isFinite(Number(n)) && Number(n) >= 0;
    if (!validText(exercise) || !nonNegNum(sets) || !nonNegNum(reps) || !nonNegNum(weight)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Fetch ordered docs to map index → _id scoped to this user
    const docs = await Workouts.find({ username }).sort({ createdAt: 1 }).toArray();
    if (index >= docs.length) return res.status(404).json({ error: "Not found" });

    const targetId = docs[index]._id;

    const s = Number(sets), r = Number(reps), w = Number(weight);
    const allZero = (s === 0 && r === 0 && w === 0);
    const volume = allZero ? null : s * r * w;

    await Workouts.updateOne(
      { _id: targetId, username },
      { $set: {
          exercise: exercise.trim(),
          sets: s, reps: r, weight: w,
          volume
        }}
    );

    const fresh = await Workouts.find({ username })
      .sort({ createdAt: 1 })
      .project({ username: 0 })
      .toArray();
    res.json(fresh);
  } catch (e) {
    console.error("POST /api/update failed:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/delete", ensureAuth, async (req, res) => {
  try {
    const username = req.session.user.username;
    const { index } = req.body ?? {};
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const docs = await Workouts.find({ username }).sort({ createdAt: 1 }).toArray();
    if (index >= docs.length) return res.status(404).json({ error: "Not found" });

    const targetId = docs[index]._id;
    await Workouts.deleteOne({ _id: targetId, username });

    const fresh = await Workouts.find({ username })
      .sort({ createdAt: 1 })
      .project({ username: 0 })
      .toArray();
    res.json(fresh);
  } catch (e) {
    console.error("POST /api/delete failed:", e);
    res.status(500).json({ error: "Server error" });
  }
});


// Temporary endpoint used earlier
// Now it would be safe to remove after front-end switches to /api/workouts
/*app.get("/read", (req, res) => {
  res.json([]); // returns an empty list of workouts
});*/

// SPA fallback for any non-API route
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/status") return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Now we have to where we can connect to Mongo, in which it would
// then start HTTP server
async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  db = client.db(DB_NAME);
  Users = db.collection("users");
  Workouts = db.collection("workouts");

  await Workouts.createIndex({ username: 1, createdAt: 1 });
  await Users.createIndex({ username: 1 }, { unique: true });

  console.log(`[mongo] connected → db="${DB_NAME}"`);
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}
                                                                        

start().catch(err => {                                                    
  console.error("Failed to start server:", err);                          
  process.exit(1);                                                        
});                                         