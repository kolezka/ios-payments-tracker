import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import { sendMagicLinkEmail } from "../mail";
import { magicLinkSchema, updateNameSchema } from "../schemas";
import type { User } from "../types";
import { generateEncryptionKey } from "../crypto";

const auth = new Hono();

auth.post("/magic-link", async (c) => {
  const body = await c.req.json();
  const result = magicLinkSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { email } = result.data;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare("INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);

  try {
    await sendMagicLinkEmail(email, token);
  } catch (err) {
    logger.error({ email, error: String(err) }, "failed to send magic link email");
    return c.json({ error: "Failed to send email" }, 500);
  }

  logger.info({ email }, "magic link sent");
  return c.json({ success: true });
});

auth.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  const link = db.prepare(
    "SELECT * FROM magic_links WHERE token = ? AND used = 0"
  ).get(token) as { email: string; expires_at: string; id: number } | null;

  if (!link) {
    return c.json({ error: "Invalid or expired link" }, 400);
  }

  if (new Date(link.expires_at) < new Date()) {
    return c.json({ error: "Link has expired" }, 400);
  }

  db.prepare("UPDATE magic_links SET used = 1 WHERE id = ?").run(link.id);

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(link.email) as User | null;

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const encKey = await generateEncryptionKey();
    db.prepare("INSERT INTO users (email, name, api_token, encryption_key) VALUES (?, ?, ?, ?)").run(link.email, "", apiToken, encKey);
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(link.email) as User;
    logger.info({ email: link.email, userId: user.id }, "new user created via magic link");
  } else {
    logger.info({ email: link.email, userId: user.id }, "existing user logged in via magic link");
  }

  return c.json({ api_token: user.api_token, is_new: user.name === "" });
});

auth.get("/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: "GitHub OAuth not configured" }, 500);
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
  const redirectUri = `${baseUrl}/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;

  return c.redirect(url);
});

auth.post("/github/callback", async (c) => {
  const { code } = await c.req.json();
  if (!code) {
    return c.json({ error: "Code is required" }, 400);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.json({ error: "GitHub OAuth not configured" }, 500);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    logger.warn({ error: tokenData.error }, "GitHub OAuth token exchange failed");
    return c.json({ error: "GitHub authentication failed" }, 400);
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
  });
  const ghUser = (await userRes.json()) as { id: number; login: string; name: string | null; email: string | null };

  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const emails = (await emailsRes.json()) as { email: string; primary: boolean }[];
    email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? null;
  }

  if (!email) {
    return c.json({ error: "Could not retrieve email from GitHub" }, 400);
  }

  const ghIdStr = String(ghUser.id);
  const name = ghUser.name ?? ghUser.login;

  let user = db.prepare("SELECT * FROM users WHERE github_id = ?").get(ghIdStr) as User | null;
  if (!user) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | null;
    if (user) {
      db.prepare("UPDATE users SET github_id = ?, name = CASE WHEN name = '' THEN ? ELSE name END WHERE id = ?")
        .run(ghIdStr, name, user.id);
    }
  }

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const encKey = await generateEncryptionKey();
    db.prepare("INSERT INTO users (email, name, github_id, api_token, encryption_key) VALUES (?, ?, ?, ?, ?)")
      .run(email, name, ghIdStr, apiToken, encKey);
    user = db.prepare("SELECT * FROM users WHERE github_id = ?").get(ghIdStr) as User;
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "new user created via GitHub");
  } else {
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "existing user logged in via GitHub");
  }

  return c.json({ api_token: user.api_token, is_new: false });
});

auth.patch("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = updateNameSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(result.data.name, user.id);
  logger.info({ userId: user.id, name: result.data.name }, "user name updated");
  return c.json({ success: true });
});

auth.get("/me", (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT id, email, name, api_token, created_at FROM users WHERE api_token = ?").get(token) as Omit<User, "github_id"> | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(user);
});

export default auth;
