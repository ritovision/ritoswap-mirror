/*
  Warnings:

  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Token";

-- CreateTable
CREATE TABLE "token_ritonet" (
    "tokenId" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "token_ritonet_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "token_sepolia" (
    "tokenId" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "token_sepolia_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "token_ethereum" (
    "tokenId" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "token_ethereum_pkey" PRIMARY KEY ("tokenId")
);
