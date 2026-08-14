import { PrismaClient } from "@prisma/client";

// Avoid exhausting DB connections from hot-reload in dev / repeated
// serverless invocations reusing the same warm lambda.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
