-- CreateTable
CREATE TABLE "Candle" (
    "id" SERIAL NOT NULL,
    "market" VARCHAR(10) NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" VARCHAR(10) NOT NULL,
    "time" INTEGER NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_market_symbol_interval_time_idx" ON "Candle"("market", "symbol", "interval", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_market_symbol_interval_time_key" ON "Candle"("market", "symbol", "interval", "time");
