export type MetaPixelEventName = "PageView" | "CompleteRegistration";

export type MetaPixelBeaconPayload = {
  pixelId: string | null | undefined;
  eventName: MetaPixelEventName;
  value?: number;
  currency?: string;
  contentCategory?: string;
  eventKey: string;
};

type MetaPixelBeaconWindow = Window & {
  __launchhubMetaPixelBeaconSent?: Record<string, boolean>;
  __launchhubMetaPixelLastBeaconUrl?: string | null;
  __launchhubMetaPixelLastBeaconEvent?: string | null;
};

export function cleanMetaPixelId(pixelId: string | null | undefined) {
  const cleaned = pixelId?.replace(/[^0-9]/g, "") ?? "";
  return cleaned || null;
}

export function getConfiguredMetaPixelId() {
  return cleanMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export function isMetaPixelDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).get("pixel_debug") === "1";
  } catch {
    return false;
  }
}

export function buildMetaPixelBeaconUrl({
  pixelId,
  eventName,
  value,
  currency = "HKD",
  contentCategory,
}: Omit<MetaPixelBeaconPayload, "eventKey">) {
  const safePixelId = cleanMetaPixelId(pixelId);
  if (!safePixelId) return null;

  const params = new URLSearchParams({
    id: safePixelId,
    ev: eventName,
    noscript: "1",
    dl: window.location.href,
  });

  if (document.referrer) params.set("rl", document.referrer);
  if (typeof value === "number" && Number.isFinite(value)) {
    params.set("value", String(value));
  }
  if (currency) params.set("currency", currency);
  if (contentCategory) params.set("content_category", contentCategory);

  return `https://www.facebook.com/tr?${params.toString()}`;
}

export function sendMetaPixelBeacon(payload: MetaPixelBeaconPayload) {
  const windowRef = window as MetaPixelBeaconWindow;
  const url = buildMetaPixelBeaconUrl(payload);

  if (!url) {
    return {
      sent: false,
      reason: "missing_pixel_id",
      url: null,
    };
  }

  windowRef.__launchhubMetaPixelBeaconSent ??= {};
  const guardKey = `${payload.eventName}:${payload.eventKey}`;

  if (windowRef.__launchhubMetaPixelBeaconSent[guardKey]) {
    return {
      sent: false,
      reason: "already_sent",
      url,
    };
  }

  windowRef.__launchhubMetaPixelBeaconSent[guardKey] = true;
  windowRef.__launchhubMetaPixelLastBeaconUrl = url;
  windowRef.__launchhubMetaPixelLastBeaconEvent = payload.eventName;

  const image = new Image();
  image.referrerPolicy = "no-referrer-when-downgrade";
  image.src = url;

  if (isMetaPixelDebugEnabled()) {
    console.info("[LaunchHub] Meta Pixel beacon created", {
      eventName: payload.eventName,
      url,
    });
  }

  return {
    sent: true,
    reason: null,
    url,
  };
}
