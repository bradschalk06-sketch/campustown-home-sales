"""Run scripts/verify_stats.sql against the SQLite copy of the dataset and print each result.

This is an independent check of the website's figures: it reads
data/college_town_home_sales.sqlite (opened read-only, never modified) and uses SQL,
while the website reads data/site_sales.csv and computes in JavaScript.

Run from the repository root:

    python3 scripts/verify_stats.py

Uses only the Python standard library. The SQL file can also be run with the sqlite3
command-line tool or pasted into DB Browser for SQLite.
"""

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "college_town_home_sales.sqlite"
SQL = Path(__file__).with_name("verify_stats.sql")


def statements(text: str):
    """Split the SQL file into statements, dropping sqlite3 shell dot-commands."""
    lines = [l for l in text.splitlines() if not l.lstrip().startswith(".")]
    buf, title = [], None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("-- ") and stripped[3:4].isdigit():
            title = stripped[3:]
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip()
            buf = []
            if stmt:
                yield title, stmt


def main() -> None:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    for title, stmt in statements(SQL.read_text()):
        cur = con.execute(stmt)
        if cur.description is None:
            continue
        cols = [d[0] for d in cur.description]
        print(f"\n== {title}")
        print(" | ".join(cols))
        for row in cur.fetchall():
            print(" | ".join("" if v is None else (f"{v:,.2f}" if isinstance(v, float) else f"{v:,}" if isinstance(v, int) else str(v)) for v in row))
    con.close()


if __name__ == "__main__":
    main()
