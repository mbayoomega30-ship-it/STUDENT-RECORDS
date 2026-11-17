const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/studentdb";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";
const SESSION_COOKIE = "student_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map();
const courseOptions = [
  "Bachelor of Software Engineering",
  "Bachelor of Computer Science",
  "Bachelor of Information Technology",
  "Bachelor of Business Administration",
  "Bachelor of Accounting and Finance",
  "Bachelor of Education",
];
const yearOptions = ["Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate"];
const genderOptions = ["Female", "Male", "Non-binary", "Prefer not to say"];

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.resolve(__dirname, "../frontend")));

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    regNo: { type: String, required: true, unique: true, trim: true },
    course: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    yearOfStudy: { type: String, enum: yearOptions },
    gender: { type: String, enum: genderOptions },
  },
  { timestamps: true }
);
const Student = mongoose.model("Student", studentSchema);

function getCookie(req, name) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function requireAdmin(req, res, next) {
  const token = getCookie(req, SESSION_COOKIE);
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: "Please sign in as the administrator." });
  }
  next();
}

function registrationDetails(body) {
  body = body || {};
  const selectedCourse = typeof body.course === "string" ? body.course.trim() : "";
  const otherCourse = typeof body.otherCourse === "string" ? body.otherCourse.trim() : "";
  const details = {
    name: typeof body.name === "string" ? body.name.trim() : "",
    regNo: typeof body.regNo === "string" ? body.regNo.trim() : "",
    course: selectedCourse === "Other" ? otherCourse : selectedCourse,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    yearOfStudy: typeof body.yearOfStudy === "string" ? body.yearOfStudy.trim() : "",
    gender: typeof body.gender === "string" ? body.gender.trim() : "",
  };
  if (!details.name || !details.regNo || !details.course || !details.email) {
    return { error: "Please complete all required fields." };
  }
  if (selectedCourse !== "Other" && !courseOptions.includes(selectedCourse)) {
    return { error: "Please select a valid programme." };
  }
  if (details.yearOfStudy && !yearOptions.includes(details.yearOfStudy)) {
    return { error: "Please select a valid year of study." };
  }
  if (details.gender && !genderOptions.includes(details.gender)) {
    return { error: "Please select a valid gender option." };
  }
  if (details.name.length > 120 || details.regNo.length > 40 || details.course.length > 120) {
    return { error: "One or more fields are too long." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email) || details.email.length > 254) {
    return { error: "Enter a valid email address." };
  }
  if (!details.yearOfStudy) delete details.yearOfStudy;
  if (!details.gender) delete details.gender;
  return { details };
}

app.post("/api/admin/login", (req, res) => {
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  const expectedHash = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  const suppliedHash = crypto.createHash("sha256").update(supplied).digest();
  if (!crypto.timingSafeEqual(expectedHash, suppliedHash)) {
    return res.status(401).json({ error: "Incorrect password. Please try again." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
  res.json({ message: "Signed in." });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  adminSessions.delete(getCookie(req, SESSION_COOKIE));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", path: "/" });
  res.json({ message: "Signed out." });
});

app.get("/api/admin/session", requireAdmin, (_req, res) => {
  res.json({ authenticated: true });
});

async function createStudent(req, res) {
  const { details, error } = registrationDetails(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const student = await Student.create(details);
    res.status(201).json({ message: "Registration saved.", id: student._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That registration number is already registered." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("Student registration failed:", err.message);
    res.status(500).json({ error: "We could not submit your registration. Please try again." });
  }
}

app.post("/api/students", createStudent);
app.post("/api/admin/students", requireAdmin, createStudent);

app.get("/api/students", requireAdmin, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = escaped
      ? { $or: [{ name: new RegExp(escaped, "i") }, { regNo: new RegExp(escaped, "i") }, { course: new RegExp(escaped, "i") }, { email: new RegExp(escaped, "i") }, { yearOfStudy: new RegExp(escaped, "i") }, { gender: new RegExp(escaped, "i") }] }
      : {};
    const students = await Student.find(filter).sort({ createdAt: -1 }).lean();
    res.json(students);
  } catch (err) {
    console.error("Could not load student registrations:", err.message);
    res.status(500).json({ error: "Could not load registrations." });
  }
});

app.put("/api/students/:id", requireAdmin, async (req, res) => {
  const { details, error } = registrationDetails(req.body);
  if (error) return res.status(400).json({ error });

  const update = { $set: details, $unset: {} };
  if (!details.yearOfStudy) update.$unset.yearOfStudy = 1;
  if (!details.gender) update.$unset.gender = 1;
  if (Object.keys(update.$unset).length === 0) delete update.$unset;

  try {
    const student = await Student.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    student
      ? res.json({ message: "Registration updated.", student })
      : res.status(404).json({ error: "Registration not found." });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Registration not found." });
    if (err.code === 11000) return res.status(409).json({ error: "That registration number is already registered." });
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    console.error("Could not update student registration:", err.message);
    res.status(500).json({ error: "Could not update registration." });
  }
});

app.delete("/api/students/:id", requireAdmin, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    student ? res.json({ message: "Registration deleted." }) : res.status(404).json({ error: "Registration not found." });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Registration not found." });
    console.error("Could not delete student registration:", err.message);
    res.status(500).json({ error: "Could not delete registration." });
  }
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exitCode = 1;
  });
