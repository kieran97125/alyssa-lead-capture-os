"use client";

import { useEffect, useState } from "react";

type PreviewSection = {
  id: string;
  label: string;
};

export function LandingPageEditorFollowPreview({
  previewUrl,
  sections = [],
}: {
  previewUrl: string;
  sections?: PreviewSection[];
}) {
  const [activeLabel, setActiveLabel] = useState(
    sections[0]?.label ?? "頁面設定"
  );
  const [sectionLinks, setSectionLinks] = useState<PreviewSection[]>(sections);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-editor-section]")
    );
    if (elements.length === 0) return;
    const observedSections = elements.map((element, index) => {
      const label =
        element.getAttribute("data-editor-section-label") ||
        element.querySelector("h2")?.textContent?.trim() ||
        `Section ${index + 1}`;
      const id = element.id || `editor-section-${index + 1}`;

      if (!element.id) element.id = id;
      return { id, label };
    });
    window.requestAnimationFrame(() => {
      setSectionLinks(observedSections);
      setActiveLabel(observedSections[0]?.label ?? "頁面設定");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const label =
          visible?.target.getAttribute("data-editor-section-label") ||
          visible?.target.querySelector("h2")?.textContent?.trim();
        if (label) setActiveLabel(label);
      },
      {
        rootMargin: "-18% 0px -60% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-[#fff6f0] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          目前編輯
        </p>
        <p className="mt-2 text-lg font-bold text-[#321428]">{activeLabel}</p>
      </div>
      <a
        href={previewUrl}
        className="inline-flex w-full justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
      >
        開啟公開頁預覽
      </a>
      <div className="grid gap-2">
        {sectionLinks.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`rounded-xl bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348] transition hover:bg-white`}
          >
            {section.label}
          </a>
        ))}
      </div>
    </div>
  );
}
