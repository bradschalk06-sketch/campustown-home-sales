# Campus Housing Explorer

An interactive housing-market dashboard built on 35,442 home sales near 11 U.S. university campuses, with a spotlight on Champaign–Urbana.

## Live site

**https://bradschalk06-sketch.github.io/campustown-home-sales/**

The site is public and needs no sign-in. It is published by GitHub Pages from the `main` branch.

## What this site is for

**Question:** How do home prices, home sizes and selling speed compare across college towns, and where does Champaign–Urbana fit?

**Audience:** students, families, faculty and staff weighing a move to a college town, and anyone curious about campus-area housing markets.

The site has four interactive sections and a methodology section:

| Section | What it shows | How to interact |
|---|---|---|
| **1. Market Overview** | Number of sales, median sale price, median price per square foot and median days on market. Also a monthly chart of sales count and median price, and a price distribution chart. | Filter by university and city. The city list narrows to the chosen university. Use Reset to go back to all markets. |
| **2. University Market Comparison** | A ranked bar chart for the 11 campus areas, a sales-volume chart and a sortable scorecard table. The University of Illinois Urbana-Champaign is highlighted in orange. | Switch the chart between median price, $/sq ft, days on market and home size. Hover bars for details. Click table headings to sort. |
| **3. Champaign–Urbana Spotlight** | A card each for Champaign, Urbana and Savoy, a combined price and $/sq ft chart, the spread of days on market, and a ranking of all 18 cities in the dataset with the three C–U cities highlighted. The summary sentence is generated from the data. | Switch the city ranking between median price, $/sq ft and number of sales. |
| **4. Property Explorer** | Individual sales as recorded in the dataset: address, city and ZIP, campus area, sale date, price, beds, baths, square feet, $/sq ft, year built, miles to campus and days on market. | Search by address, ZIP or listing ID. Filter by university, city, minimum and maximum price, bedrooms and maximum distance to campus. Sort by price, $/sq ft, date, size, distance or days on market, or click a column heading. Pages hold 25 rows. The results can be downloaded as CSV. On phones, rows display as cards. |
| **5. Methodology** | The cleaning rules, with the count of rows each rule affects, plus the citation. | — |

## Data notes

**Source file.** The site reads `data/site_sales.csv`. `scripts/build_site_data.py` makes that file from `data/college_town_home_sales.csv`. It contains **all 35,442 rows** and keeps 15 of the 34 columns. It changes no values and drops no rows. The five original dataset files are unchanged. All filtering and every statistic is computed in the browser by `js/app.js`, so nothing on the page is typed in by hand.

**Rules applied, one for each of the "Five things that will bite you" in `docs/data_description_sheet.md`:**

1. **Implausible prices.** A sale counts only if **$10,000 ≤ sale price ≤ $5,000,000**. That leaves out 40 sales under $10,000 (including one at $0) and 31 over $5,000,000 (up to $81.5 million). The **analysis set is 35,371 sales**, and every median, count and chart on the site uses it. The Property Explorer has a checkbox that also lists the 71 excluded sales. They are tagged "Outside price rule" and are left out of the explorer's medians.
2. **Price per square foot.** Sale price ÷ `living_area_sqft`, only where living area is recorded **and greater than 0**. In the analysis set, 373 rows have no living area and 127 report 0, so price per square foot uses 34,871 sales. The same rule applies to median home size.
3. **Days on market.** `contract_date − list_date` (listing to accepted offer), **not** `sale_date − list_date`. A sale needs both dates to count, and a missing date is **never treated as 0**. That gives 28,028 sales (79.2% of the analysis set). Coverage varies by market (for example 65% for Iowa and 67% for Penn State), and homes sold without a listing are often new construction. So the site shows the coverage next to every days-on-market figure. Medians are used because the distribution has a long upper tail.
4. **Unique key.** `listing_id` is the key (35,442 unique ids for 35,442 rows). **Nothing is removed as a duplicate by street address.** For example, the 10 condo sales at 456 E Beaver Ave in State College are 10 different units, and all 10 appear in the explorer. `zipcode` is read as text so leading zeros are kept.
5. **`home_type`** is unreliable (it labels condo units `SINGLE_FAMILY`), so it is **not used anywhere** on the site. Other impossible values the sheet mentions (lot size, a 60-bathroom home, a $1 billion tax bill) are not used in any statistic. Lot size and tax are not loaded at all. Baths are shown in the explorer exactly as recorded.

**Definitions used on the site:**

- **Median:** the middle value, or the mean of the two middle values when the count is even. That's why one median price is $434,010.
- **Campus area / university:** the dataset's `university` column, the nearest campus by the property's coordinates. The University of Illinois area is Champaign, Urbana and Savoy.
- **Miles to campus:** straight-line distance, as supplied.
- **Monthly chart:** grouped by the month of `sale_date`. The 6 rows with no sale date can't be placed in a month and are left out of that chart only. March 2023 and March 2026 are partial months.

## Verifying the figures

Three or more figures were checked a second, independent way. `scripts/verify_stats.sql` recomputes them with SQL against the **SQLite** copy of the data (`data/college_town_home_sales.sqlite`, opened read-only), while the website uses JavaScript on the CSV. The results match:

| Figure | Website (JavaScript) | SQL check on SQLite |
|---|---:|---:|
| Sales in the analysis set ($10K–$5M) | 35,371 | 35,371 |
| Sales excluded: under $10K / over $5M | 40 / 31 | 40 / 31 |
| Median sale price, all markets | $410,000 | $410,000.00 |
| Median price per sq ft, all markets | $212 | $211.92 |
| Median days on market, all markets (n) | 11 days (28,028) | 11.00 (28,028) |
| UIUC area: sales, median price | 3,663, $245,000 | 3,663, $245,000.00 |
| Champaign: sales, median price, median $/sq ft | 2,285, $240,000, $150 | 2,285, $240,000.00, $149.68 |
| Urbana: sales, median price, median $/sq ft | 1,131, $229,900, $144 | 1,131, $229,900.00, $144.35 |
| Savoy: sales, median price, median $/sq ft | 247, $402,700, $187 | 247, $402,700.00, $186.74 |
| Explorer: UIUC, 3 beds, $200K–$300K, ≤ 2.0 miles | 159 matching sales | 159 |

The median sale price for all 11 universities also matches the SQL output exactly. The scorecard's $/sq ft, home size, days on market, coverage and distance columns were checked a third way, with pandas in Python. The website shows dollar figures rounded to the nearest dollar.

**How to check it yourself:**

- **No installation needed:** open `data/college_town_home_sales.xlsx` in Excel and filter `sale_price` to between 10,000 and 5,000,000. The row count is 35,371 and `=MEDIAN()` of the price column is 410,000. Then filter `university` to University of Illinois Urbana-Champaign: 3,663 rows with a median of 245,000.
- **With Python 3** (standard library only), from the repository root:
  ```bash
  python3 scripts/verify_stats.py        # runs scripts/verify_stats.sql on the SQLite file
  python3 scripts/build_site_data.py     # rebuilds data/site_sales.csv; the file is identical
  ```
- **With the sqlite3 tool:** `sqlite3 -readonly data/college_town_home_sales.sqlite < scripts/verify_stats.sql`
- **On the site:** the Methodology section shows the live row counts behind each rule, and the Property Explorer's CSV download includes each row's computed `price_per_sqft`, `days_on_market` and `meets_price_rule`.

## How it is built

- Plain **HTML, CSS and JavaScript** with no build step: `index.html`, `css/styles.css`, `js/app.js`.
- **Chart.js 4.4.1** draws the charts and **Papa Parse 5.4.1** parses the CSV. Both are MIT-licensed and saved in `vendor/` (with their licenses), so the site doesn't depend on an outside CDN.
- All paths are relative (`data/site_sales.csv`), as GitHub Pages requires.
- The data file is 4.8 MB (about 1.2 MB compressed in transfer), less than the 8.7 MB original.
- `.github/workflows/pages.yml` (unchanged from the template) publishes the repository to GitHub Pages on every push to `main`.

| Path | What it is |
|---|---|
| `index.html` | The site |
| `css/styles.css`, `js/app.js` | Styles, and all data processing and interaction |
| `vendor/` | Chart.js and Papa Parse, with licenses |
| `data/site_sales.csv` | Made by `scripts/build_site_data.py`. All rows, 15 columns |
| `data/college_town_home_sales.*` | The five original dataset files, unchanged |
| `scripts/build_site_data.py` | Makes `data/site_sales.csv` |
| `scripts/verify_stats.sql`, `scripts/verify_stats.py` | Independent SQL check of the site's figures |
| `docs/data_description_sheet.md` | The dataset's documentation |
| `AGENTS.md`, `AGENT_LOG.md` | Coding-agent instructions and the log of the agent's work |

## Tools we used

- **AI coding agent:** Claude (Anthropic), working in a cloud workspace. See `AGENT_LOG.md`.
- **Libraries:** Chart.js 4.4.1 and Papa Parse 5.4.1.
- **Checking:** Python 3 (`sqlite3`, `csv`, pandas) for the independent checks, and headless Google Chrome (Playwright) to test the page at desktop (1440 px) and phone (390 px) widths.
- **Hosting:** GitHub Pages with GitHub Actions.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
