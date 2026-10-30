"""Explicit schema initialization and authoritative Census location ingestion."""

import argparse
import csv
import os
import io
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from backend.resources import Base, Location


def import_census(db: Session, path: Path, states_path: Path | None = None):
    """Read Census SUB-EST national CSV: 040 states, 050 counties, 157 place parts.

    Place parts preserve many-to-many county/place relationships. Rows at 162 supply
    the canonical incorporated-place name. No private geocoding or hand-written lists.
    """
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        # National population-estimate CSVs use Windows-1252 for accented names.
        text = raw.decode("cp1252")
    rows = list(csv.DictReader(io.StringIO(text)))
    required = {"SUMLEV", "STATE", "COUNTY", "PLACE", "NAME", "STNAME"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError("Expected the official Census SUB-EST CSV layout")
    names = {
        (r["STATE"].zfill(2), r["PLACE"].zfill(5)): r["NAME"]
        for r in rows
        if r["SUMLEV"].zfill(3) == "162"
    }
    count = 0
    aliases = {}
    if states_path:
        with states_path.open(encoding="utf-8-sig", newline="") as file:
            aliases = {
                r["STATE"].zfill(2): r["STUSAB"]
                for r in csv.DictReader(file, delimiter="|")
            }
    for r in rows:
        level = r["SUMLEV"].zfill(3)
        state = r["STATE"].zfill(2)
        county = state + r["COUNTY"].zfill(3)
        place = state + r["PLACE"].zfill(5)
        if level == "040":
            row = Location(
                key=f"state:{state}",
                kind="state",
                code=state,
                name=r["NAME"],
                parent="",
                aliases=[aliases[state]] if state in aliases else [],
            )
        elif level == "050":
            row = Location(
                key=f"county:{county}",
                kind="county",
                code=county,
                name=r["NAME"],
                parent=state,
            )
        elif level == "157" and r["PLACE"].zfill(5) != "00000":
            name = names.get(
                (state, r["PLACE"].zfill(5)), r["NAME"].replace(" (part)", "")
            )
            row = Location(
                key=f"city:{place}:{county}",
                kind="city",
                code=place,
                name=name,
                parent=county,
            )
        else:
            continue
        db.merge(row)
        count += 1
    if not count:
        raise ValueError("No usable geography records found")
    db.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["init-db", "import-census"])
    parser.add_argument("--file", type=Path)
    parser.add_argument("--states-file", type=Path)
    args = parser.parse_args()
    engine = create_engine(os.environ["DATABASE_URL"])
    if args.command == "init-db":
        Base.metadata.create_all(engine)
    else:
        if not args.file:
            parser.error("--file is required")
        with Session(engine) as db:
            print(
                f"Imported {import_census(db,args.file,args.states_file)} Census location records"
            )


if __name__ == "__main__":
    main()
