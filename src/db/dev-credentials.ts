/**
 * Sign-in for the seeded owner on local/dev databases. Shared by the seed and the e2e setup
 * so the two never drift. Override with SEED_PASSWORD; never use these values in production.
 */
export const DEV_CREDENTIALS = {
  email: "owner@apex.test",
  password: process.env.SEED_PASSWORD || "apex-demo-2026",
};
