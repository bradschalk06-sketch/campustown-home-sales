-- Independent check of figures shown on the website.
-- Runs against the SQLite copy of the dataset (data/college_town_home_sales.sqlite),
-- not the CSV the site reads, using SQL instead of the site's JavaScript.
-- Run from the repository root:  sqlite3 -readonly data/college_town_home_sales.sqlite < scripts/verify_stats.sql
-- Price rule: 10,000 <= sale_price <= 5,000,000. Median = middle value, or mean of the two middle values.
.mode box
.headers on

DROP VIEW IF EXISTS temp.clean;
CREATE TEMP VIEW clean AS
SELECT *,
       CASE WHEN living_area_sqft > 0 THEN 1.0 * sale_price / living_area_sqft END AS ppsf,
       CASE WHEN list_date IS NOT NULL AND contract_date IS NOT NULL
            THEN julianday(contract_date) - julianday(list_date) END AS dom
FROM home_sales
WHERE sale_price BETWEEN 10000 AND 5000000;

-- 1. Row counts and the price rule
SELECT (SELECT COUNT(*) FROM home_sales)                         AS all_rows,
       (SELECT COUNT(DISTINCT listing_id) FROM home_sales)       AS unique_listing_ids,
       (SELECT COUNT(*) FROM home_sales WHERE sale_price < 10000)   AS under_10k,
       (SELECT COUNT(*) FROM home_sales WHERE sale_price > 5000000) AS over_5m,
       (SELECT COUNT(*) FROM clean)                              AS analysis_set,
       (SELECT COUNT(*) FROM clean WHERE ppsf IS NOT NULL)       AS ppsf_rows,
       (SELECT COUNT(*) FROM clean WHERE dom IS NOT NULL)        AS dom_rows;

-- 2. Overall medians (all campus areas)
WITH p AS (SELECT sale_price v, ROW_NUMBER() OVER (ORDER BY sale_price) rn, COUNT(*) OVER () n FROM clean),
     s AS (SELECT ppsf v, ROW_NUMBER() OVER (ORDER BY ppsf) rn, COUNT(*) OVER () n FROM clean WHERE ppsf IS NOT NULL),
     d AS (SELECT dom v, ROW_NUMBER() OVER (ORDER BY dom) rn, COUNT(*) OVER () n FROM clean WHERE dom IS NOT NULL)
SELECT (SELECT AVG(v) FROM p WHERE rn IN ((n + 1) / 2, (n + 2) / 2)) AS median_price,
       (SELECT ROUND(AVG(v), 2) FROM s WHERE rn IN ((n + 1) / 2, (n + 2) / 2)) AS median_ppsf,
       (SELECT AVG(v) FROM d WHERE rn IN ((n + 1) / 2, (n + 2) / 2)) AS median_days_on_market;

-- 3. Median sale price and sales by university
WITH r AS (SELECT university, sale_price,
                  ROW_NUMBER() OVER (PARTITION BY university ORDER BY sale_price) rn,
                  COUNT(*) OVER (PARTITION BY university) n
           FROM clean)
SELECT university, MAX(n) AS sales, AVG(sale_price) AS median_price
FROM r WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY university ORDER BY median_price DESC;

-- 4. Champaign-Urbana spotlight: sales, median price and median price per sq ft by city
WITH r AS (SELECT city, sale_price, ROW_NUMBER() OVER (PARTITION BY city ORDER BY sale_price) rn, COUNT(*) OVER (PARTITION BY city) n
           FROM clean WHERE state = 'IL'),
     q AS (SELECT city, ppsf, ROW_NUMBER() OVER (PARTITION BY city ORDER BY ppsf) rn, COUNT(*) OVER (PARTITION BY city) n
           FROM clean WHERE state = 'IL' AND ppsf IS NOT NULL)
SELECT r.city, MAX(r.n) AS sales, AVG(r.sale_price) AS median_price,
       (SELECT ROUND(AVG(ppsf), 2) FROM q WHERE q.city = r.city AND rn IN ((n + 1) / 2, (n + 2) / 2)) AS median_ppsf
FROM r WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY r.city ORDER BY r.city;

-- 5. Property Explorer example: UIUC area, 3 bedrooms, $200,000-$300,000, within 2.0 miles of campus
SELECT COUNT(*) AS matching_sales
FROM clean
WHERE university = 'University of Illinois Urbana-Champaign'
  AND beds = 3 AND sale_price BETWEEN 200000 AND 300000 AND miles_to_campus <= 2.0;
