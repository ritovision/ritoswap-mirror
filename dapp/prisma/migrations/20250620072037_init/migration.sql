-- CreateTable
CREATE TABLE "Token" (
    "tokenId" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Token_pkey" PRIMARY KEY ("tokenId")
);
