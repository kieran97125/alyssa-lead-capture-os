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
    name: "膚質分析及療程諮詢",
    slug: "skin-renewal-consult",
    description:
      "由專人了解你的膚況、改善目標同預算，建議合適療程方向。",
  },
  {
    id: "medical-beauty-trial",
    name: "醫學美容體驗療程",
    slug: "medical-beauty-trial",
    description:
      "適合首次到訪、想了解療程效果同配搭方案的客人。",
  },
];

export const alyssaPackages = [
  {
    id: "consultation-booking",
    treatmentId: "skin-renewal-consult",
    name: "免費諮詢預約",
    originalPrice: 0,
    promoPrice: 0,
    currency: "HKD",
    paymentRequired: false,
  },
  {
    id: "trial-package-388",
    treatmentId: "medical-beauty-trial",
    name: "首次體驗優惠",
    originalPrice: 980,
    promoPrice: 388,
    currency: "HKD",
    paymentRequired: true,
  },
];

export const alyssaBranches = [
  { id: "central", name: "中環", slug: "central" },
  { id: "causeway-bay", name: "銅鑼灣", slug: "causeway-bay" },
  { id: "tsim-sha-tsui", name: "尖沙咀", slug: "tsim-sha-tsui" },
];

export const alyssaDefaultForm = {
  id: "alyssa-main-form",
  publicFormToken: "alyssa-main-form-dev-token",
  brandId: alyssaBrand.id,
  formName: "Alyssa Main Registration Form",
  status: "active",
  allowedDomains: ["localhost", "127.0.0.1"],
  defaultTreatmentId: "medical-beauty-trial",
  defaultPackageId: "trial-package-388",
  defaultBranchId: "central",
};
