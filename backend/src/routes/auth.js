import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.js";
import { Employee } from "../models/Employee.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { authRequired, setAuthCookie, signToken } from "../middleware/auth.js";

const router = Router();

function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      !process.env.GOOGLE_CLIENT_ID.includes("your-google-client-id")
  );
}

export function setupPassport() {
  if (!googleConfigured()) {
    console.log("Google OAuth not configured — demo login is available");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || "Employee";
          const picture = profile.photos?.[0]?.value;
          let user = await User.findOne({ googleId: profile.id });
          if (!user && email) {
            user = await User.findOne({ email });
          }
          if (!user) {
            const employee = await Employee.findOne({ email });
            if (!employee) {
              return done(null, false);
            }
            user = await User.create({
              googleId: profile.id,
              email,
              name,
              picture,
              empId: employee.empId,
              role: "employee",
            });
            await LeaveBalance.findOneAndUpdate(
              { empId: user.empId },
              { $setOnInsert: { empId: user.empId } },
              { upsert: true }
            );
          } else {
            user.googleId = profile.id;
            user.name = name;
            user.picture = picture;
            await user.save();
          }
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      done(null, await User.findById(id));
    } catch (err) {
      done(err);
    }
  });
}

router.get("/config", (_req, res) => {
  res.json({ googleEnabled: googleConfigured() });
});

router.get(
  "/google",
  (req, res, next) => {
    if (!googleConfigured()) {
      return res.status(400).json({
        message: "Google login is not configured. Add GOOGLE_CLIENT_ID in backend/.env",
      });
    }
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google`,
  }),
  (req, res) => {
    const token = signToken(req.user);
    setAuthCookie(res, token);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

router.post("/admin", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "Admin@123";
  if (username.toLowerCase() !== adminUser.toLowerCase() || password !== adminPass) {
    return res.status(401).json({ message: "Invalid admin username or password" });
  }
  let user = await User.findOne({ email: "admin@flowhcm.local" });
  if (!user) {
    user = await User.create({
      email: "admin@flowhcm.local",
      name: "Super Admin",
      empId: "ADMIN",
      role: "admin",
    });
  } else {
    user.name = "Super Admin";
    user.empId = "ADMIN";
    user.role = "admin";
    await user.save();
  }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user, null) });
});

router.post("/demo", async (req, res) => {
  const empId = String(req.body?.empId || "").trim();
  if (!empId) {
    return res.status(400).json({ message: "Employee code is required, e.g. 240" });
  }
  let employee = await Employee.findOne({ empId });
  if (!employee) {
    const hasLogs = await AttendanceLog.exists({ empId });
    if (!hasLogs) {
      return res.status(404).json({ message: `Employee ${empId} not found in attendance machines.` });
    }
    employee = await Employee.create({
      empId,
      name: `Employee ${empId}`,
      jobTitle: "Employee",
      department: "Operations",
      email: `${empId}@flowhcm.local`,
    });
    await LeaveBalance.findOneAndUpdate(
      { empId },
      { $setOnInsert: { empId, casual: 10, annual: 14, sick: 8 } },
      { upsert: true }
    );
  }
  let user =
    (await User.findOne({ empId: employee.empId })) ||
    (await User.findOne({ email: employee.email || `${empId}@flowhcm.local` }));
  if (!user) {
    user = await User.create({
      email: employee.email || `${empId}@flowhcm.local`,
      name: employee.name,
      empId: employee.empId,
      role: "employee",
    });
  } else {
    user.empId = employee.empId;
    user.name = employee.name;
    user.role = "employee";
    await user.save();
  }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user, employee) });
});

router.get("/me", authRequired, async (req, res) => {
  const employee = await Employee.findOne({ empId: req.user.empId });
  res.json({ user: publicUser(req.user, employee) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

function publicUser(user, employee) {
  const isSuperAdmin = user.role === "admin" && user.empId === "ADMIN";
  return {
    id: user._id,
    name: isSuperAdmin ? "Super Admin" : employee?.name || user.name,
    email: user.email,
    picture: user.picture || employee?.avatar,
    empId: user.empId,
    jobTitle: isSuperAdmin ? "Super Admin" : employee?.jobTitle || "Employee",
    department: isSuperAdmin ? "Administration" : employee?.department || "Operations",
    role: user.role,
    isSuperAdmin,
  };
}

export default router;
