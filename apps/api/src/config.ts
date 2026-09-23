export const config = {
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://emporio:emporio@localhost:5432/emporio",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  sessionDays: 7,
  timeZone: process.env.APP_TIME_ZONE ?? "America/Sao_Paulo",
};

export const corsOrigins: Array<string | RegExp> = [
  ...config.webOrigin.split(",").map((origin) => origin.trim()).filter(Boolean),
  ...(!config.isProduction ? [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/] : []),
];
