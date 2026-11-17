"""Make data/site_sales.csv, the smaller file the website loads.

Reads the original dataset (data/college_town_home_sales.csv), which is never modified,
and writes the same 35,442 rows with only the columns the site uses. No values are
changed and no rows are dropped: the website applies the cleaning rules itself
(see README.md, "Data notes"), so every figure on the page is computed in the browser
from these rows.

Run from the repository root:

    python3 scripts/build_site_data.py

Uses only the Python standard library.
"""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "college_town_home_sales.csv"
OUTPUT = ROOT / "data" / "site_sales.csv"

COLUMNS = [
    "listing_id",
    "address_street",
    "city",
    "state",
    "zipcode",
    "university",
    "miles_to_campus",
    "list_date",
    "contract_date",
    "sale_date",
    "sale_price",
    "beds",
    "baths",
    "living_area_sqft",
    "year_built",
]


def main() -> None:
    # Read every field as text so ZIP codes and ids keep their exact form.
    with SOURCE.open(newline="", encoding="utf-8") as src:
        reader = csv.DictReader(src)
        missing = [c for c in COLUMNS if c not in reader.fieldnames]
        if missing:
            raise SystemExit(f"Columns not found in source: {missing}")
        rows = [{c: row[c] for c in COLUMNS} for row in reader]

    ids = [r["listing_id"] for r in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("listing_id is not unique; stopping.")

    with OUTPUT.open("w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows):,} rows and {len(COLUMNS)} columns to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
