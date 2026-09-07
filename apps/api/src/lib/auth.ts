import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { sessions, users, type UserRole } from "../db/schema";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
};

function hashToken(token: string) {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, days: number) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + days * 86_400_000),
  });
  return token;
}

export async function getAuthUser(authorization?: string): Promise<AuthUser | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const [result] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      department: users.department,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return result ?? null;
}

export async function deleteSession(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(authorization.slice(7).trim())));
}

export function can(user: AuthUser, roles: UserRole[]) {
  return user.role === "administrador" || roles.includes(user.role);
}
