# U.S. Congressional Trade Tracker Dashboard (Demo Preview)

A fast, responsive trade intelligence dashboard tracking financial disclosures from U.S. Congressional members and Executive branch officials. 

This repository showcases the front-end components, charting capabilities, and responsive dashboard layouts of the tracker. It runs completely offline and serverlessly in **Demo Mode**, utilizing a pre-seeded local SQLite database containing fictional mock data. All proprietary ranking metrics, forecasting models, and third-party APIs (such as LLMs and news feeds) have been stripped from this version to protect intellectual property.

## Features

- **Disclosure Tape:** Real-time mock list of recent congressional and executive filings.
- **Sector Flow Analytics:** Interactive chart measuring net buy/sell volumes across major market sectors.
- **Factual Ticker Drilldowns:** Drill into individual stocks (e.g. `NVDA`, `AAPL`, `MSFT`) to view:
  - Custom daily candlestick charts with Bollinger Bands, Volume averages, RSI, and MACD overlays.
  - Simplified earnings metrics pulled from SEC filings.
  - Standard street analyst targets and consensus.
  - Timeline of congressional transaction disclosures.

## Tech Stack

- **Framework:** Next.js (App Router, Turbopack, React Server Components)
- **Database client:** Prisma Client (SQLite native driver)
- **Styling:** Tailwind CSS & Vanilla CSS
- **Charts:** Recharts / Lightweight Charts
- **Database Engine:** SQLite (Local file `prisma/demo.db`)

## Local Setup

Follow these steps to run the demo dashboard locally:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Database & Generate Client:**
   This command creates the database tables and compiles the Prisma client:
   ```bash
   npx prisma db push
   ```

3. **Seed Database:**
   Populate the database with the mock stocks, trades, and timeline price bars:
   ```bash
   npx prisma db seed
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Deployment to Vercel

Since the database schema is ignored from version control for privacy, you must configure a private environment variable during deployment:

1. Import this repository into Vercel.
2. In the **Project Environment Variables**, add:
   - **Key:** `PRISMA_SCHEMA`
   - **Value:** Paste the contents of your `schema.prisma` file.
3. Deploy. The build process will automatically reconstruct the schema and generate the client on Vercel's serverless environment.

---

*Disclaimer: This is a demo preview utilizing fictional mock data. None of the information presented constitutes financial, investment, tax, or legal advice.*
