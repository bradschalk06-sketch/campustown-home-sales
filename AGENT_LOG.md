# Agent log

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Copy this outline for each entry:

```markdown
## YYYY-MM-DD: What you worked on

- **Asked:** "Paste your prompt here."
- **Agent produced:** What it made or changed.
- **Checked or changed:** How you checked it, and what you fixed.
```

---

## 2026-11-17: Inspecting the starter and planning the Campus Housing Explorer

- **Agent:** Claude (Anthropic), in a cloud workspace with access to this repository.
- **Asked** (excerpt from my project brief; the full brief also listed the four site features, the dataset rules and the GitHub requirements): "Build and publish a polished, interactive, public website using the provided dataset containing 35,442 home sales near 11 university campuses. … Create a professional, modern housing-market analytics dashboard. It should look like a polished real-estate research platform rather than a basic school project. … First, inspect the repository and tell me your implementation plan. Then proceed with the work, following the repository's approval requirements."
- **Agent produced:** Its first step tried to attach the professor's starter repository (`uidfc-business-emerging-technologies/campustown-home-sales-starter`) instead of my own copy.
- **Checked or changed:** **The agent got this wrong, and I caught it.** I rejected the request and redirected it: "I've created my own public GitHub repository from the course template. My repository: https://github.com/bradschalk06-sketch/campustown-home-sales Please use MY repository for all development, commits, branches, and pull requests. Do not attempt to modify the professor's original starter repository. Read AGENTS.md and docs/data_description_sheet.md in my repository before making changes."
- **Agent produced (after the fix):** It cloned my repository and read `AGENTS.md`, `docs/data_description_sheet.md`, the README and the Pages workflow. Then it proposed a plan and waited for approval, as `AGENTS.md` requires before a large change. The plan covered:
  - a price rule ($10K–$5M)
  - $/sq ft only where living area > 0
  - days on market = contract − list date, with no blank treated as 0
  - `listing_id` as the key
  - no use of `home_type`
  - a script that makes a smaller CSV
  - plain HTML/CSS/JS with Chart.js
  - a `dashboard` branch and pull request

## 2026-11-17: Building, testing and verifying the dashboard

- **Asked:** "I approve your implementation plan. I've already enabled GitHub Pages with GitHub Actions. Please proceed with building the complete Campus Housing Explorer dashboard in my repository. Keep the proposed data-cleaning rules, preserve all original dataset files, and prioritize a polished, professional website with fully functional interactive features. Work on the `dashboard` branch and open a pull request when finished. Verify the calculations carefully and complete the README and AGENT_LOG.md."
- **Agent produced:**
  - `scripts/build_site_data.py` makes `data/site_sales.csv`: all 35,442 rows, 15 columns, values unchanged. Rerunning it gives a byte-identical file (same MD5).
  - `index.html`, `css/styles.css` and `js/app.js` are the dashboard: Market Overview with university/city filters and four KPIs; a University Comparison chart with a metric toggle, a volume chart and a sortable scorecard, with UIUC in orange; the Champaign–Urbana Spotlight; a Property Explorer with search, six filters, sorting, paging and CSV download; and a Methodology section whose counts are computed live.
  - `vendor/` holds local copies of Chart.js 4.4.1 and Papa Parse 5.4.1, with their MIT licenses.
  - `scripts/verify_stats.sql` and `scripts/verify_stats.py` are an independent SQL check against the SQLite copy of the data.
  - The README was rewritten and this log entry added.
- **Checked:**
  - The site was loaded in headless Chrome at 1440 px and 390 px wide, with no JavaScript errors. Every filter, toggle, sort, the pager, the "include excluded sales" checkbox and the CSV download were exercised by script.
  - The figures were compared with SQL on the SQLite file and with pandas: analysis-set count 35,371, median price $410,000, median $/sq ft $211.92, median days on market 11 (n = 28,028), all 11 university medians, the Champaign, Urbana and Savoy figures, and an explorer filter result of 159 rows. All matched. The table is in the README.
  - Searching "456 E Beaver" in the explorer returns all 10 condo units, so nothing was deduplicated by address. That matches the data description sheet.
  - `git diff` confirms the five original dataset files are unchanged.
- **Mistakes the agent caught and fixed during testing:**
  - The Spotlight summary first read "ranks 1st-lowest." It was spotted in a screenshot and rewritten to "is the lowest of the 11."
  - The scorecard table was wider than the card on a desktop screen and cut off its last column. The headings now wrap.
  - On phones, the explorer table needed sideways scrolling. Rows now turn into cards on narrow screens.
  - The day-range labels on the days-on-market chart were tilted and hard to read. They were shortened.
  - The short-money formatter would have shown $10,000,000 as "$1M". It was fixed before release, although no sale in the analysis set goes above $5M.

2026-11-17: Final website review and deployment

Asked: I asked Claude to build an interactive housing-market dashboard using the college-town home sales dataset and publish the changes through GitHub.

Agent produced: Claude created the Campus Housing Explorer dashboard, including market statistics, university comparisons, a Champaign–Urbana spotlight, a property explorer, and documentation.

Checked or changed: I reviewed the completed dashboard, merged Pull Request #1 into the main branch, enabled GitHub Pages, and opened the published website to verify that the dashboard loaded correctly. I also added the public website URL to the repository's About section. Earlier, I caught that Claude was attempting to connect to the professor's starter repository rather than my own and redirected it to the correct repository.
