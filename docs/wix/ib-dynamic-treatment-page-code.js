// Wix Velo page code for the shared IB Dynamic Treatment Page.
// Required element IDs:
// - Dataset: #dynamicDataset (connected to IBTreatments)
// - HTML Component: #launchHubFormHtml

$w.onReady(function () {
  var currentItem = null;
  var loaderReady = false;

  function buildFormPayload(item) {
    return {
      targetId: "launchhub-dynamic-form-root",
      formToken: item.formToken || "",
      brand: "ineffable",
      formId: item.formId || "",
      pixelId: item.pixelId || "1020143980486592",
      pixelEventValue: Number(item.pixelValue || item.price || 0),
      pixelCurrency: item.currency || "HKD",
      conversionMode: "thank_you_redirect",
      successRedirectUrl: item.successRedirect || "",
      height: 760,
      debug: false
    };
  }

  function sendFormConfiguration() {
    if (!loaderReady || !currentItem) return;

    $w("#launchHubFormHtml").postMessage({
      type: "launchhub:configure-form",
      payload: buildFormPayload(currentItem)
    });
  }

  $w("#launchHubFormHtml").onMessage(function (event) {
    var data = event.data || {};

    if (data.type === "launchhub:dynamic-loader-ready") {
      loaderReady = true;
      sendFormConfiguration();
    }

    if (data.type === "launchhub:dynamic-loader-error") {
      console.warn("[IB Dynamic Treatment] LaunchHub loader error", data.detail || {});
    }
  });

  $w("#dynamicDataset").onReady(function () {
    currentItem = $w("#dynamicDataset").getCurrentItem();
    sendFormConfiguration();
  });
});
