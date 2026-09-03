from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


component_path = "src/components/creative/CreativeJobCollaborationDialog.tsx"
component = read(component_path)
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
component = replace_once(
    component,
    '''  return (
    <Dialog.Root>''',
    '''  return (
    <Dialog.Root defaultOpen={defaultOpen}>''',
    "collaboration defaultOpen root",
)
write(component_path, component)


story = '''import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreativeJobCollaborationDialog } from "./CreativeJobCollaborationDialog";

const meta = {
  title: "Creative/Creative Job Collaboration Dialog",
  component: CreativeJobCollaborationDialog,
  parameters: {
    layout: "fullscreen",
  },
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
        externalUrl: "https://example.invalid/final-v1",
        storagePath: null,
        mimeType: null,
        fileSize: null,
        createdByEmail: "designer@example.test",
        createdAt: "2026-09-03T05:10:00.000Z",
        url: "https://example.invalid/final-v1",
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


css_path = "src/components/creative/CreativeBriefEditor.module.css"
css = read(css_path)
old_css = '''.colorControl {
  position: relative;
  display: inline-flex;
  min-width: 42px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: #6d4a5c;
  transition: 140ms ease;
}

.colorControl:hover {
  border-color: #e5d3db;
  background: #fff4f7;
  color: #5a2348;
}

.colorControl:focus-within {
  outline: 3px solid rgba(90, 35, 72, 0.18);
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
  border: 1px solid rgba(50, 20, 40, 0.2);
  border-radius: 999px;
  box-shadow: 0 0 0 2px #fff;
}'''
new_css = '''.colorControl {
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
  outline: 3px solid
    color-mix(in oklch, var(--system-ring) 24%, transparent);
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
  border: 1px solid
    color-mix(in oklch, var(--system-foreground) 20%, transparent);
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--system-card);
}'''
css = replace_once(css, old_css, new_css, "semantic colour control CSS")
write(css_path, css)


e2e_path = "e2e/creative-production.spec.ts"
e2e = read(e2e_path)
old_assertions = '''  await expect(dialog).not.toContainText("Brief Screenshot Only");
  await expect(dialog.getByText("加入 Google Drive／交付連結")).toBeVisible();

  await dialog.getByTestId("creative-comments-tab").click();'''
new_assertions = '''  await expect(dialog).not.toContainText("Brief Screenshot Only");
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
    old_assertions,
    new_assertions,
    "collaboration deterministic screenshot",
)
write(e2e_path, e2e)


contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
contract = replace_once(
    contract,
    '''const collaborationDialog = read(
  "src/components/creative/CreativeJobCollaborationDialog.tsx"
);
const editorStyles''',
    '''const collaborationDialog = read(
  "src/components/creative/CreativeJobCollaborationDialog.tsx"
);
const collaborationStory = read(
  "src/components/creative/CreativeJobCollaborationDialog.stories.tsx"
);
const editorStyles''',
    "collaboration story contract read",
)
contract = replace_once(
    contract,
    '''assert.match(collaborationDialog, /Brief Screenshot 只作解釋/);
assert.match(editorStyles, /position: sticky/);''',
    '''assert.match(collaborationDialog, /Brief Screenshot 只作解釋/);
assert.match(collaborationDialog, /defaultOpen/);
assert.match(collaborationStory, /OpenDeliverables/);
assert.match(collaborationStory, /defaultOpen: true/);
assert.match(creativeE2e, /creative-collaboration-dialog-desktop\.png/);
assert.match(editorStyles, /position: sticky/);''',
    "collaboration visual contract",
)
contract = replace_once(
    contract,
    '''assert.doesNotMatch(createDialog, /command-primary-button/);
assert.doesNotMatch(creativePage, /text-\[7px\]/);''',
    '''assert.doesNotMatch(createDialog, /command-primary-button/);
assert.doesNotMatch(creativePage, /text-\[7px\]/);
assert.doesNotMatch(
  editorStyles.match(/\.colorControl \{[\s\S]*?\.colorSwatch \{[\s\S]*?\}/)?.[0] || "",
  /#[0-9a-f]{3,8}|rgba?\(/i
);''',
    "semantic colour control contract",
)
write(contract_path, contract)


learning_path = "docs/product-learning/entries/2026-09-03-creative-job-density-requester-provenance.md"
learning = read(learning_path)
learning = learning.replace(
    "- Sticky controls must not introduce horizontal page overflow or unbounded line length.",
    "- Sticky controls must not introduce horizontal page overflow or unbounded line length. New on-demand side sheets require Storybook and deterministic screenshot coverage, and new controls must use semantic system tokens.",
)
write(learning_path, learning)

print("Implemented final Creative design gates and visual coverage.")
