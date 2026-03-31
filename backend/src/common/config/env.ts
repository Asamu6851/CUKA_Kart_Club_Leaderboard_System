type EnvConfig = Record<string, unknown>;

const requiredKeys = [
  "PORT",
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CORS_ORIGIN"
];

export function validateEnv(config: EnvConfig) {
  const missingKeys = requiredKeys.filter((key) => {
    const value = String(config[key] ?? "").trim();
    return !value;
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing environment variables: ${missingKeys.join(", ")}`);
  }

  return config;
}
