// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// server.js 

// The design is meant to set up to have express server 
// with sessions, as well as having a simple login/logout API.
import dotenv from 'dotenv';
dotenv.config({ path: './OAuth.env' }); // Absolute Path
import express from "express";
import helmet from "helmet";          // Security Headers
import morgan from "morgan";          // Request Logging
import session from "express-session"; // Session Middleware
import path from "path";
import { fileURLToPath } from "url";

// MongoDB driver
import { MongoClient } from "mongodb";  

// Auth deps
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import MongoStore from 'connect-mongo';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mongo connection config/handles
// Updated to be able to accept both env names to avoid mismatches 
const MONGODB_URI = 
    process.env.MONGODB_URI || 
    process.env.MONGOB_URI ||
    "mongodb://127.0.0.1:27017"; 

const DB_NAME = process.env.DB_NAME || "workout_app";                        
let db, Users, Workouts;   

// Middleware
app.use(helmet()); // Purpose is to add common security headers
app.use(morgan("dev")); // Now we can have it where it logs requests to console
app.use(express.urlencoded({ extended: false }));  
app.use(express.json());                           
app.use(express.static(path.join(__dirname, "public")));

// To be able to have it to where secure cookies behave correctly 
// behind Render’s proxy, I implemented a trust proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      dbName: DB_NAME,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7, // 7 days
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Serialize the minimal data we need into the session cookie
passport.serializeUser((user, done) => {
  // user here is whatever we pass to done() in the strategy verify callback
  const slim = {
    id: user.id,
    username: user.username, // GitHub login
    displayName: user.displayName || user.username || `github:${user.id}`,
    avatar: user.avatar || null,
  };
  done(null, slim);
});
passport.deserializeUser((obj, done) => done(null, obj));

// GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Upsert a local "user" record for convenience (optional, good hygiene)
        const doc = {
          githubId: profile.id,
          username: profile.username ?? `github_${profile.id}`,
          displayName: profile.displayName ?? profile.username ?? null,
          avatar:
            (Array.isArray(profile.photos) && profile.photos[0]?.value) || null,
          updatedAt: new Date(),
        };

        if (Users) {
          await Users.updateOne(
            { githubId: profile.id },
            {
              $set: {
                username: doc.username,
                displayName: doc.displayName,
                avatar: doc.avatar,
                updatedAt: doc.updatedAt,
              },
              $setOnInsert: {
                githubId: profile.id,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
        }

        // Pass a minimal object to the session
        return done(null, {
          id: profile.id,
          username: doc.username,
          displayName: doc.displayName,
          avatar: doc.avatar,
        });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Purpose is to detect JSON fetch vs. form post
function wantsJSON(req) {
  return (
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept || '').includes('application/json')
  );
}

// Now we have it where Auth guard now uses Passport
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.get("/status", (req, res) => res.json({ ok: true }));

app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['read:user', 'user:email'] })
);

app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    // success → back to SPA
    res.redirect('/');
  }
);

// Logout via Passport + clear session
app.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      if (wantsJSON(req)) return res.json({ ok: true });
      return res.redirect('/');
    });
  });
});

// Return session user info 
app.get("/api/me", (req, res) => {
    res.json({ user: req.user || null, firstLogin: false });
});

// This prevents console errors from main.js (initWorkoutsUI)
// Now we have it to where for Results endpoint — all workouts for the logged-in user
// READ: all workouts for the logged-in user
app.get("/api/workouts", ensureAuth, async (req, res) => {
  try {
    if (!Workouts) return res.status(503).json({ error: "Database not ready" }); // <---

    const username = req.user?.username || `github:${req.user?.id}`;
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
    const username = req.user?.username || `github:${req.user?.id}`;

    const {
      exercise,
      sets,
      reps,
      weight,
      type: rawType,
      bodyweight: rawBodyweight,
      notes: rawNotes
    } = req.body ?? {};

    const validText = s => typeof s === "string" && s.trim().length >= 2 && /[a-z]/i.test(s);
    const nonNegNum = n => Number.isFinite(Number(n)) && Number(n) >= 0;

    if (!validText(exercise)) return res.status(400).json({ error: "Invalid exercise" });
    if (!nonNegNum(sets) || !nonNegNum(reps) || !nonNegNum(weight)) {
      return res.status(400).json({ error: "Invalid numeric fields" });
    }

    // Sanitize Extras
    const type = (rawType === "activity" || rawType === "strength") ? rawType : "strength";
    const bodyweight = (rawBodyweight === true || rawBodyweight === "true");
    const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
    if (notes.length > 500) return res.status(400).json({ error: "Notes too long (max 500)" });

    // Rules
    const s = Number(sets), r = Number(reps), w = Number(weight);
    const allZero = (s === 0 && r === 0 && w === 0);
    const strengthPattern = (s > 0 && r > 0 && w >= 0);

    if (type === "activity") {
      if (!allZero) return res.status(400).json({ error: "Activity rows should use sets=0,reps=0,weight=0" });
    } else {
      if (!strengthPattern) return res.status(400).json({ error: "Strength rows require sets>0, reps>0, weight>=0" });
    }

    const volume = (type === "strength") ? s * r * w : null;

    await Workouts.insertOne({
      username,
      exercise: exercise.trim(),
      sets: s,
      reps: r,
      weight: w,
      volume,
      type,
      bodyweight,
      notes,
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

// UPDATE: if the user would like to change the data the inputted
app.post("/api/update", ensureAuth, async (req, res) => {
  try {
    const username = req.user?.username || `github:${req.user?.id}`;

    const {
      index,
      exercise,
      sets,
      reps,
      weight,
      type: rawType,
      bodyweight: rawBodyweight,
      notes: rawNotes
    } = req.body ?? {};

    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const validText = s => typeof s === "string" && s.trim().length >= 2 && /[a-z]/i.test(s);
    const nonNegNum = n => Number.isFinite(Number(n)) && Number(n) >= 0;

    if (!validText(exercise)) return res.status(400).json({ error: "Invalid exercise" });
    if (!nonNegNum(sets) || !nonNegNum(reps) || !nonNegNum(weight)) {
      return res.status(400).json({ error: "Invalid numeric fields" });
    }

    // Now we have it where we would map the index to the document
    const docs = await Workouts.find({ username }).sort({ createdAt: 1 }).toArray();
    if (index >= docs.length) return res.status(404).json({ error: "Not found" });

    const targetId = docs[index]._id;

    // Sanitize Extras
    const type = (rawType === "activity" || rawType === "strength") ? rawType : "strength";
    const bodyweight = (rawBodyweight === true || rawBodyweight === "true");
    const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
    if (notes.length > 500) return res.status(400).json({ error: "Notes too long (max 500)" });

    // Rules
    const s = Number(sets), r = Number(reps), w = Number(weight);
    const allZero = (s === 0 && r === 0 && w === 0);
    const strengthPattern = (s > 0 && r > 0 && w >= 0);

    if (type === "activity") {
      if (!allZero) return res.status(400).json({ error: "Activity rows should use sets=0,reps=0,weight=0" });
    } else {
      if (!strengthPattern) return res.status(400).json({ error: "Strength rows require sets>0, reps>0, weight>=0" });
    }

    const volume = (type === "strength") ? s * r * w : null;

    await Workouts.updateOne(
      { _id: targetId, username },
      {
        $set: {
          exercise: exercise.trim(),
          sets: s,
          reps: r,
          weight: w,
          volume,
          type,
          bodyweight,
          notes
        }
      }
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


// DELETE: In case the user does not want the data they inputted there 
// any longer
app.post("/api/delete", ensureAuth, async (req, res) => {
  try {
    const username = req.user?.username || `github:${req.user?.id}`;
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA fallback for any non-API route
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/status") return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Move the final 404 ABOVE start() so it's always registered
app.use((req, res) => {
  console.warn('404:', req.method, req.originalUrl);
  res.status(404).send('Not Found');
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
  await Users.createIndex({ githubId: 1 },
    {
      unique: true,
      partialFilterExpression: { githubId: { $exists: true, $type: "string" } }
    }
  );

  console.log(`[mongo] connected → db="${DB_NAME}"`);
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}
                                                                        
start().catch(err => {                                                    
  console.error("Failed to start server:", err);                          
  process.exit(1);                                                        
});