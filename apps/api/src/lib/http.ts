import { ZodError, type ZodType } from "zod";
import type { AuthUser } from "./auth";
import { getAuthUser } from "./auth";

export async function requireUser(authorization: string | undefined, set: { status?: number | string }) {
  const user = await getAuthUser(authorization);
  if (!user) set.status = 401;
  return user;
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

function postgresCode(error: unknown): string | undefined {
  // O drizzle encapsula o erro do driver em `cause`.
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = candidate?.code ?? candidate?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

export function isForeignKeyViolation(error: unknown) {
  return postgresCode(error) === "23503";
}

export function apiError(error: unknown, set: { status?: number | string }) {
  if (error instanceof ZodError) {
    set.status = 422;
    return { message: "Revise os dados informados.", errors: error.flatten().fieldErrors };
  }
  if (postgresCode(error) === "23505") {
    set.status = 409;
    return { message: "Já existe um cadastro com esses dados." };
  }
  if (isForeignKeyViolation(error)) {
    set.status = 409;
    return { message: "Este cadastro está vinculado a outros registros e não pode ser excluído." };
  }
  console.error(error);
  set.status = 500;
  return { message: "Não foi possível concluir a operação." };
}

export function forbidden(set: { status?: number | string }, user?: AuthUser | null) {
  set.status = user ? 403 : 401;
  return { message: user ? "Seu perfil não permite esta ação." : "Sessão inválida ou expirada." };
}
