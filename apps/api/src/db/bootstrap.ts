import { z } from "zod";
import { client, db } from ".";
import { users } from "./schema";

// Read the initial account from stdin so secrets stay out of command arguments.
try {
  const input = z.object({
    email: z.string().email(),
    password: z.string().min(16),
  }).parse(JSON.parse(await Bun.stdin.text()));
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) {
    console.log("Banco já possui usuários; acesso existente preservado.");
  } else {
    await db.insert(users).values({
      name: "Administrador",
      email: input.email.toLowerCase(),
      passwordHash: await Bun.password.hash(input.password),
      role: "administrador",
      department: "Gestão",
    });
    console.log("Administrador inicial criado.");
  }
} finally {
  await client.end();
}
