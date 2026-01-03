// app/lib/prisma/prisma.ts
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { nodeConfig } from '@config/node.env'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: nodeConfig.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(withAccelerate())

if (!nodeConfig.isProduction) globalForPrisma.prisma = prisma
