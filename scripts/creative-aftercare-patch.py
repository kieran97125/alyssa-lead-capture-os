from pathlib import Path


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text and new not in text:
        raise SystemExit(f"{path}: marker missing: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


replace_all(
    "src/lib/creative/store.ts",
    "mapJob(row as RawRow,",
    "mapJob(row as unknown as RawRow,",
)

print("Creative Studio TypeScript aftercare patches completed.")
