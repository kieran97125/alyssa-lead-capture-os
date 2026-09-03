from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# 1) Fix the contract verifier that currently breaks every Vercel build.
contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
invalid_marker = "\n\nassert.match(workspaceSource, /CreativeBriefHistoryDialog/);"
if invalid_marker in contract:
    start = contract.index(invalid_marker)
    end = contract.index("\nconsole.log(", start)
    contract = contract[:start] + "\n" + contract[end:]

if "workspaceSource" in contract or "editorSource" in contract:
    raise RuntimeError("Undefined legacy contract aliases remain")

collaboration_read = '''const collaborationDialog = read(
  "src/components/creative/CreativeJobCollaborationDialog.tsx"
);'''
if "CreativeJobCollaborationDialog.stories.tsx" not in contract:
    contract = replace_once(
        contract,
        collaboration_read,
        collaboration_read
        + '''
const collaborationStory = read(
  "src/components/creative/CreativeJobCollaborationDialog.stories.tsx"
);
const creativeE2e = read("e2e/creative-production.spec.ts");''',
        "collaboration story contract read",
    )

story_assert_anchor = 'assert.match(collaborationDialog, /Brief Screenshot 只作解釋/);'
if "OpenDeliverables" not in contract:
    contract = replace_once(
        contract,
        story_assert_anchor,
        story_assert_anchor
        + '''
assert.match(collaborationDialog, /defaultOpen/);
assert.match(collaborationStory, /OpenDeliverables/);
assert.match(collaborationStory, /defaultOpen: true/);
assert.match(creativeE2e, /creative-collaboration-dialog-desktop\\.png/);
assert.match(
  editorStyles,
  /\\.colorControl[\\s\\S]*?var\\(--system-muted-foreground\\)/
);''',
        "collaboration visual contract",
    )
write(contract_path, contract)


# 2) Give Storybook a deterministic open-dialog state.
component_path = "src/components/creative/CreativeJobCollaborationDialog.tsx"
component = read(component_path)
if "defaultOpen?: boolean;" not in component:
    component = replace_once(
        component,
        '''  canContribute: boolean;
  fixtureMode?: boolean;
};''',
        '''  canContribute: boolean;
  fixtureMode?: boolean;
  defaultOpen?: boolean;
};''',
        "collaboration defaultOpen type",
    )
if "defaultOpen = false," not in component:
    component = replace_once(
        component,
        '''  canContribute,
  fixtureMode = false,
}: CreativeJobCollaborationDialogProps) {''',
        '''  canContribute,
  fixtureMode = false,
  defaultOpen = false,
}: CreativeJobCollaborationDialogProps) {''',
        "collaboration defaultOpen argument",
    )
if '<Dialog.Root defaultOpen={defaultOpen}>' not in component:
    component = replace_once(
        component,
        "    <Dialog.Root>",
        "    <Dialog.Root defaultOpen={defaultOpen}>",
        "collaboration defaultOpen root",
    )
write(component_path, component)


# 3) Replace raw colour values in the new control with semantic system tokens.
css_path = "src/components/creative/CreativeBriefEditor.module.css"
css = read(css_path)
semantic_block = '''.colorControl {
  position: relative;
  display: inline-flex;
  min-width: 42px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  color: var(--system-muted-foreground);
  transition: 140ms ease;
}

.colorControl:hover {
  border-color: var(--system-border);
  background: var(--system-accent);
  color: var(--system-accent-foreground);
}

.colorControl:focus-within {
  outline: 3px solid var(--system-ring);
  outline-offset: 1px;
}

.colorControl input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}

.colorSwatch {
  width: 10px;
  height: 10px;
  border: 1px solid var(--system-border);
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--system-card);
}'''
colour_pattern = re.compile(
    r"\.colorControl \{[\s\S]*?\.colorSwatch \{[\s\S]*?\n\}",
    re.MULTILINE,
)
css, count = colour_pattern.subn(semantic_block, css, count=1)
if count != 1:
    raise RuntimeError(f"semantic colour-control replacement: found {count}")
write(css_path, css)


# 4) Add a real Storybook visual state for the on-demand collaboration sheet.
story = '''import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreativeJobCollaborationDialog } from "@/components/creative/CreativeJobCollaborationDialog";

const meta = {
  title: "Creative/Creative Job Collaboration Dialog",
  component: CreativeJobCollaborationDialog,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    jobId: "storybook-job",
    returnPath: "/creative-jobs/storybook-job",
    canContribute: true,
    fixtureMode: true,
    defaultOpen: true,
    assets: [
      {
        id: "storybook-final",
        jobId: "storybook-job",
        assetKind: "link",
        purpose: "final",
        label: "Final V1 Review Link",
        externalUrl: "https://example.com/final-v1",
        storagePath: null,
        mimeType: null,
        fileSize: null,
        createdByEmail: "designer@example.test",
        createdAt: "2026-09-03T05:10:00.000Z",
        url: "https://example.com/final-v1",
      },
      {
        id: "storybook-brief-only",
        jobId: "storybook-job",
        assetKind: "upload",
        purpose: "brief",
        label: "Brief Screenshot Only",
        externalUrl: null,
        storagePath: "creative-jobs/storybook-job/brief.png",
        mimeType: "image/png",
        fileSize: 1024,
        createdByEmail: "marketer@example.test",
        createdAt: "2026-09-03T05:05:00.000Z",
        url: "/api/creative-jobs/storybook-job/assets/storybook-brief-only",
      },
    ],
    comments: [
      {
        id: "storybook-comment",
        authorMemberId: "storybook-designer",
        authorName: "Designer",
        authorEmail: "designer@example.test",
        body: "已提交 Final V1，請確認字幕同 CTA。",
        createdAt: "2026-09-03T05:15:00.000Z",
      },
    ],
  },
} satisfies Meta<typeof CreativeJobCollaborationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenDeliverables: Story = {};
'''
write(
    "src/components/creative/CreativeJobCollaborationDialog.stories.tsx",
    story,
)


# 5) Add a deterministic screenshot baseline for the open collaboration sheet.
e2e_path = "e2e/creative-production.spec.ts"
e2e = read(e2e_path)
if "creative-collaboration-dialog-desktop.png" not in e2e:
    screenshot_anchor = '''  await expect(dialog).not.toContainText("Brief Screenshot Only");
  await expect(dialog.getByText("加入 Google Drive／交付連結")).toBeVisible();

  await dialog.getByTestId("creative-comments-tab").click();'''
    screenshot_replacement = '''  await expect(dialog).not.toContainText("Brief Screenshot Only");
  await expect(dialog.getByText("加入 Google Drive／交付連結")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(dialog).toHaveScreenshot(
    "creative-collaboration-dialog-desktop.png",
    { animations: "disabled", caret: "hide" }
  );

  await dialog.getByTestId("creative-comments-tab").click();'''
    e2e = replace_once(
        e2e,
        screenshot_anchor,
        screenshot_replacement,
        "collaboration screenshot acceptance",
    )
write(e2e_path, e2e)


# 6) Record the production-layout invariant: every historic and new Job uses
# the same two-column Studio component, with collaboration opened on demand.
learning_path = "docs/product-learning/entries/2026-09-03-creative-job-density-requester-provenance.md"
learning = read(learning_path)
line = (
    "- Historic and newly created Jobs render through the same two-column "
    "Studio component; this layout change is not gated by Job age or migration state."
)
if line not in learning:
    guardrail = "- Existing permissions, calendar sync, notifications, audit, versions, assets and comments remain intact."
    learning = replace_once(
        learning,
        guardrail,
        guardrail + "\n" + line,
        "historic Job layout guardrail",
    )
write(learning_path, learning)

print("Creative production release corrections applied.")
