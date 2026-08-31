from pathlib import Path

path = Path("src/app/creative-jobs/page.tsx")
text = path.read_text(encoding="utf-8")
import_line = 'import type { ReactNode } from "react";\n'
while text.count(import_line) > 1:
    text = text.replace(import_line + import_line, import_line, 1)
if text.count(import_line) != 1:
    raise SystemExit(
        f"Expected exactly one ReactNode import after cleanup, found {text.count(import_line)}"
    )
path.write_text(text, encoding="utf-8")
print("Creative Studio duplicate imports removed.")
