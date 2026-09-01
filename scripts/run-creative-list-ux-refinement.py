from pathlib import Path
import runpy

patch_path = Path("scripts/creative-list-ux-refinement.py")
patch = patch_path.read_text(encoding="utf-8")
patch = patch.replace(
    'import { useRef, useState, type ComponentType, type ReactNode } from "react";',
    'import {\n  useRef,\n  useState,\n  type ComponentType,\n  type MouseEvent,\n  type ReactNode,\n  type RefObject,\n} from "react";',
)
patch = patch.replace("React.RefObject", "RefObject")
patch = patch.replace("React.MouseEvent", "MouseEvent")
patch = patch.replace(
    r'border border\\[#e8dcd5\\] bg-white',
    r'border border-\[#e8dcd5\] bg-white',
)

# Code replacements contain TypeScript regex literals such as \d. Passing those
# strings directly as Python re replacement templates interprets the backslash.
# Use replacement callbacks so generated source is written verbatim.
patch = patch.replace(
    "text, count = re.subn(pattern, replacement, text, count=1)",
    "text, count = re.subn(pattern, lambda _match: replacement, text, count=1)",
)
patch = patch.replace(
    "text, count = header_pattern.subn(header_replacement, text, count=1)",
    "text, count = header_pattern.subn(lambda _match: header_replacement, text, count=1)",
)
patch = patch.replace(
    "text, count = list_pattern.subn(list_replacement, text, count=1)",
    "text, count = list_pattern.subn(lambda _match: list_replacement, text, count=1)",
)
patch = patch.replace(
    "text, count = pattern.subn(replacement, text, count=1)",
    "text, count = pattern.subn(lambda _match: replacement, text, count=1)",
)
patch = patch.replace(
    "        nav_item_replacement,\n        text,",
    "        lambda _match: nav_item_replacement,\n        text,",
)
patch_path.write_text(patch, encoding="utf-8")

nav_path = Path("src/components/alyssa/AppNavClient.tsx")
nav = nav_path.read_text(encoding="utf-8")
indented_brand = '''      <div className="command-brand">
        <IntentPrefetchLink
          href="/dashboard"
          onClick={onNavigate}
          className="command-brand-link"
        >
          <span className="command-brand-mark" aria-hidden="true">
            GO
          </span>
          <span className="min-w-0">
            <span className="command-brand-eyebrow">Alyssa Growth OS</span>
            <span className="command-brand-title">營運中心</span>
          </span>
        </IntentPrefetchLink>
      </div>'''
dedented_brand = '''<div className="command-brand">
  <IntentPrefetchLink
    href="/dashboard"
    onClick={onNavigate}
    className="command-brand-link"
  >
    <span className="command-brand-mark" aria-hidden="true">
      GO
    </span>
    <span className="min-w-0">
      <span className="command-brand-eyebrow">Alyssa Growth OS</span>
      <span className="command-brand-title">營運中心</span>
    </span>
  </IntentPrefetchLink>
</div>'''
if indented_brand in nav:
    nav = nav.replace(indented_brand, dedented_brand, 1)
nav_path.write_text(nav, encoding="utf-8")

runpy.run_path(str(patch_path), run_name="__main__")

nav = nav_path.read_text(encoding="utf-8")
bad_aside = '<aside\\n        className={`${styles.sidebarHost} command-sidebar ${open ? "is-open" : ""}`}\\n        data-collapsed={collapsed ? "true" : "false"}\\n      >'
good_aside = '''<aside
        className={`${styles.sidebarHost} command-sidebar ${open ? "is-open" : ""}`}
        data-collapsed={collapsed ? "true" : "false"}
      >'''
if bad_aside in nav:
    nav = nav.replace(bad_aside, good_aside, 1)
nav_path.write_text(nav, encoding="utf-8")

runner = Path("scripts/run-creative-list-ux-refinement.py")
if runner.exists():
    runner.unlink()

print("Creative Jobs UX refinement runner completed.")
