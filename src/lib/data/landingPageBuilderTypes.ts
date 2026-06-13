export type LandingPageStatus = "draft" | "published" | "archived";

export type LandingPageMode = "form_only" | "landing_page";

export type LandingPageTemplateKey =
  | "offer-landing-page"
  | "consultation-landing-page"
  | "treatment-trial-landing-page"
  | "minimal-form-capture-page";

export type LandingPageImageAssets = {
  hero_image_url?: string;
  mobile_hero_image_url?: string;
  offer_image_url?: string;
  treatment_image_url?: string;
  process_image_1_url?: string;
  process_image_2_url?: string;
  process_image_3_url?: string;
  trust_image_url?: string;
};

export type LandingPageContent = {
  hero_title: string;
  hero_subtitle: string;
  offer_badge: string;
  offer_headline: string;
  offer_body: string;
  cta_text: string;
  secondary_cta_text?: string;
  pain_points: string[];
  benefits: string[];
  trust_items: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  process_steps: Array<{
    title: string;
    body: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export type LandingPageBuilderRecord = {
  id: string;
  slug: string;
  title: string;
  brand_id: string | null;
  treatment_id: string | null;
  package_id: string | null;
  branch_id: string | null;
  form_id: string | null;
  template_key: LandingPageTemplateKey;
  mode: LandingPageMode;
  status: LandingPageStatus;
  content_json: LandingPageContent;
  image_assets_json: LandingPageImageAssets;
  published_version_id: string | null;
};
