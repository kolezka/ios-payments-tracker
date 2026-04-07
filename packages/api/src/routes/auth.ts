import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import db, { schema } from "../db";
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

  await db.insert(schema.magicLinks).values({ email, token, expiresAt });

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

  const [link] = await db.select().from(schema.magicLinks)
    .where(and(eq(schema.magicLinks.token, token), eq(schema.magicLinks.used, 0)));

  if (!link) {
    return c.json({ error: "Invalid or expired link" }, 400);
  }

  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Link has expired" }, 400);
  }

  await db.update(schema.magicLinks).set({ used: 1 }).where(eq(schema.magicLinks.id, link.id));

  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, link.email));

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const encKey = await generateEncryptionKey();
    [user] = await db.insert(schema.users).values({
      email: link.email, name: "", apiToken, encryptionKey: encKey,
    }).returning();
    logger.info({ email: link.email, userId: user.id }, "new user created via magic link");
  } else {
    logger.info({ email: link.email, userId: user.id }, "existing user logged in via magic link");
  }

  return c.json({ api_token: user.apiToken, is_new: user.name === "" });
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

  let [user] = await db.select().from(schema.users).where(eq(schema.users.githubId, ghIdStr));
  if (!user) {
    [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (user) {
      await db.update(schema.users).set({
        githubId: ghIdStr,
        name: user.name === "" ? name : user.name,
      }).where(eq(schema.users.id, user.id));
    }
  }

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const encKey = await generateEncryptionKey();
    [user] = await db.insert(schema.users).values({
      email, name, githubId: ghIdStr, apiToken, encryptionKey: encKey,
    }).returning();
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "new user created via GitHub");
  } else {
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "existing user logged in via GitHub");
  }

  return c.json({ api_token: user.apiToken, is_new: false });
});

auth.patch("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.apiToken, token ?? ""));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = updateNameSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  await db.update(schema.users).set({ name: result.data.name }).where(eq(schema.users.id, user.id));
  logger.info({ userId: user.id, name: result.data.name }, "user name updated");
  return c.json({ success: true });
});

auth.get("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const [user] = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    name: schema.users.name,
    api_token: schema.users.apiToken,
    created_at: schema.users.createdAt,
  }).from(schema.users).where(eq(schema.users.apiToken, token ?? ""));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(user);
});

export default auth;
