export const alyssaBrand = {
  id: "alyssa-brand-seed",
  name: "Alyssa",
  slug: "alyssa",
  logoUrl: "",
  primaryColor: "#5a2348",
  secondaryColor: "#c9828e",
  whatsappNumber: "+85200000000",
  defaultThankYouUrl: "/thank-you",
};

export const alyssaTreatments = [
  {
    id: "skin-renewal-consult",
    name: "Skin analysis and consultation",
    slug: "skin-renewal-consult",
    description:
      "A beauty consultant reviews skin goals and recommends the best treatment path.",
  },
  {
    id: "medical-beauty-trial",
    name: "Medical beauty trial treatment",
    slug: "medical-beauty-trial",
    description:
      "A first-visit experience for clients who want to understand treatment options.",
  },
];

export const alyssaPackages = [
  {
    id: "consultation-booking",
    treatmentId: "skin-renewal-consult",
    name: "Free consultation booking",
    originalPrice: 0,
    promoPrice: 0,
    currency: "HKD",
    paymentRequired: false,
  },
  {
    id: "trial-package-388",
    treatmentId: "medical-beauty-trial",
    name: "First-visit trial offer",
    originalPrice: 980,
    promoPrice: 388,
    currency: "HKD",
    paymentRequired: true,
  },
];

export const alyssaBranches = [
  { id: "central", name: "Central", slug: "central" },
  { id: "causeway-bay", name: "Causeway Bay", slug: "causeway-bay" },
  { id: "tsim-sha-tsui", name: "Tsim Sha Tsui", slug: "tsim-sha-tsui" },
];

export const alyssaDefaultForm = {
  id: "alyssa-main-form",
  publicFormToken: "alyssa-main-form-dev-token",
  brandId: alyssaBrand.id,
  formName: "Alyssa Main Registration Form",
  status: "active",
  allowedDomains: ["localhost", "127.0.0.1"],
  defaultTreatmentId: "skin-renewal-consult",
  defaultPackageId: "consultation-booking",
  defaultBranchId: "central",
};
