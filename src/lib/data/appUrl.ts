function cleanBaseUrl(value: string | undefined) {
  const cleaned = value?.trim().replace(/\/+$/, "");
  return cleaned || null;
}

function fallbackBaseUrl() {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3010";
  }

  return "https://YOUR_PRODUCTION_DOMAIN";
}

export function getPublicBaseUrl() {
  return (
    cleanBaseUrl(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    fallbackBaseUrl()
  );
}

export function getAdminBaseUrl() {
  return (
    cleanBaseUrl(process.env.NEXT_PUBLIC_ADMIN_BASE_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    fallbackBaseUrl()
  );
}

export function getPublicPathUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicBaseUrl()}${normalizedPath}`;
}

export function getAdminPathUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAdminBaseUrl()}${normalizedPath}`;
}

export function getPublicLandingPageUrl(slug: string) {
  return getPublicPathUrl(`/lp/${slug}`);
}

export function getPublicEmbedPreviewUrl(formToken: string) {
  return getPublicPathUrl(`/embed/${formToken}`);
}

export function getPublicAppUrl() {
  return getPublicBaseUrl();
}

export function getEmbedScriptUrl() {
  return getPublicPathUrl("/embed/alyssa-form.js");
}

export function getDefaultEmbedCode(formToken: string, formId: string) {
  return `<script
  src="${getEmbedScriptUrl()}"
  data-form-token="${formToken}"
  data-brand="alyssa"
  data-form-id="${formId}">
</script>`;
}
