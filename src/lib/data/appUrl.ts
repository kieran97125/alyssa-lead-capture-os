export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3010";
  }

  return "https://YOUR_PRODUCTION_DOMAIN";
}

export function getEmbedScriptUrl() {
  return `${getPublicAppUrl()}/embed/alyssa-form.js`;
}

export function getDefaultEmbedCode(formToken: string, formId: string) {
  return `<script
  src="${getEmbedScriptUrl()}"
  data-form-token="${formToken}"
  data-brand="alyssa"
  data-form-id="${formId}">
</script>`;
}
