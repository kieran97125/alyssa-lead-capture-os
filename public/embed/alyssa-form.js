(function () {
  var ATTRIBUTION_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
    "campaign_id",
    "adset_id",
    "ad_id",
    "ctwa_id",
    "ctwa_clid",
    "meta_ad_id",
    "meta_adset_id",
    "meta_campaign_id",
    "placement",
    "whatsapp_referral_source_id"
  ];
  var BACKUP_PARAM_MAP = {
    lh_source: "utm_source",
    lh_medium: "utm_medium",
    lh_campaign: "utm_campaign",
    lh_content: "utm_content",
    lh_term: "utm_term",
    lh_campaign_id: "campaign_id",
    lh_adset_id: "adset_id",
    lh_ad_id: "ad_id",
    lh_placement: "placement",
    lh_channel: "utm_source",
    lh_brand: "brand"
  };
  var ALL_ATTRIBUTION_KEYS = ATTRIBUTION_KEYS.concat(Object.keys(BACKUP_PARAM_MAP));

  function safeJsonParse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function createId(prefix) {
    var random = Math.random().toString(36).slice(2);
    return prefix + "_" + Date.now().toString(36) + "_" + random;
  }

  function readStorage(key, storage) {
    try {
      return safeJsonParse(storage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeStorage(key, value, storage) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function pickParams(searchParams) {
    var output = {};
    ALL_ATTRIBUTION_KEYS.forEach(function (key) {
      var value = searchParams.get(key);
      if (value) output[key] = value;
    });
    return normalizeAttributionFields(output);
  }

  function normalizeAttributionFields(input) {
    var output = Object.assign({}, input || {});

    Object.keys(BACKUP_PARAM_MAP).forEach(function (backupKey) {
      var canonicalKey = BACKUP_PARAM_MAP[backupKey];
      var value = output[backupKey];
      if (!value) return;
      if (!output[canonicalKey]) output[canonicalKey] = value;
    });

    if (!output.meta_campaign_id) {
      output.meta_campaign_id = output.campaign_id || output.lh_campaign_id || output.meta_campaign_id;
    }
    if (!output.meta_adset_id) {
      output.meta_adset_id = output.adset_id || output.lh_adset_id || output.meta_adset_id;
    }
    if (!output.meta_ad_id) {
      output.meta_ad_id = output.ad_id || output.lh_ad_id || output.meta_ad_id;
    }

    return output;
  }

  function hasKeys(value) {
    return value && Object.keys(value).length > 0;
  }

  function getOrigin(value) {
    try {
      return value ? new URL(value).origin : "";
    } catch {
      return "";
    }
  }

  function getPathname(value) {
    try {
      return value ? new URL(value).pathname : window.location.pathname;
    } catch {
      return window.location.pathname;
    }
  }

  function isWixHtmlIframe() {
    return (window.location.hostname || "").indexOf("filesusr.com") !== -1;
  }

  function getRealParentPageUrl() {
    var referrer = document.referrer || "";

    if (isWixHtmlIframe() && referrer) {
      try {
        var referrerUrl = new URL(referrer);

        if (
          referrerUrl.protocol === "https:" &&
          referrerUrl.hostname.indexOf("filesusr.com") === -1
        ) {
          return referrerUrl.toString();
        }
      } catch {
      }
    }

    return window.location.href;
  }

  function mergeSearchParams(primaryUrl, fallbackSearch) {
    var output = new URLSearchParams();

    try {
      new URL(primaryUrl).searchParams.forEach(function (value, key) {
        if (value) output.set(key, value);
      });
    } catch {
    }

    try {
      new URLSearchParams(fallbackSearch || "").forEach(function (value, key) {
        if (value && !output.has(key)) output.set(key, value);
      });
    } catch {
    }

    return output;
  }

  function getPixelValue(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function getPixelCurrency(value) {
    var cleaned = typeof value === "string" ? value.trim().toUpperCase() : "";
    return cleaned || "HKD";
  }

  function getConversionMode(value) {
    return value === "thank_you_redirect"
      ? "thank_you_redirect"
      : "form_submit_pixel";
  }

  function isLazyLoadEnabled(value) {
    return value === "true" || value === "1";
  }

  function getLazyRootMargin(value) {
    var cleaned = typeof value === "string" ? value.trim() : "";
    return cleaned || "600px";
  }

  function clampEmbedHeight(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return 500;
    return Math.max(480, Math.min(Math.ceil(parsed), 2200));
  }

  function getPixelLandingUrl(parentPageUrl) {
    if (parentPageUrl) return parentPageUrl;
    if (document.referrer) return document.referrer;
    return window.location.href;
  }

  function createCompleteRegistrationBeaconUrl(options) {
    var params = new URLSearchParams();
    params.set("id", options.pixelId);
    params.set("ev", "CompleteRegistration");
    params.set("noscript", "1");
    params.set("dl", options.pageUrl);
    params.set("cd[value]", String(options.value));
    params.set("cd[currency]", options.currency);
    params.set("cd[content_category]", "registration");

    return "https://www.facebook.com/tr?" + params.toString();
  }

  function createPlaceholder() {
    var placeholder = document.createElement("div");
    placeholder.setAttribute("aria-live", "polite");
    placeholder.style.boxSizing = "border-box";
    placeholder.style.width = "100%";
    placeholder.style.minHeight = "96px";
    placeholder.style.display = "flex";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.border = "1px solid rgba(216, 91, 163, 0.18)";
    placeholder.style.borderRadius = "18px";
    placeholder.style.background = "rgba(255, 248, 252, 0.78)";
    placeholder.style.color = "#7b5a6a";
    placeholder.style.font = "600 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    placeholder.style.margin = "0";
    placeholder.style.padding = "16px";
    placeholder.textContent = "表格載入中...";
    return placeholder;
  }

  function isAllowedSuccessRedirectUrl(value, brand) {
    var cleaned = typeof value === "string" ? value.trim() : "";
    var safeBrand = (brand || "").trim().toLowerCase();
    if (!cleaned) return false;

    try {
      var url = new URL(cleaned);
      var path = url.pathname.replace(/\/+$/, "");
      var allowedOrigin =
        safeBrand === "ineffable" || safeBrand === "ineffable-beauty"
          ? url.origin === "https://www.ineffablebeautyhk.com" ||
            url.origin === "https://ineffablebeautyhk.com"
          : false;

      return url.protocol === "https:" && allowedOrigin && path === "/thank-you";
    } catch {
      return false;
    }
  }

  function navigateTopToSuccessUrl(value, brand) {
    if (!isAllowedSuccessRedirectUrl(value, brand)) return false;

    try {
      if (window.top) {
        window.top.location.href = value;
        return true;
      }
    } catch {
    }

    try {
      window.open(value, "_top");
      return true;
    } catch {
    }

    try {
      window.location.href = value;
      return true;
    } catch {
      return false;
    }
  }

  function classifyStorageStatus(localSaved, sessionSaved) {
    if (localSaved && sessionSaved) return "storage_available";
    if (localSaved) return "session_storage_blocked";
    if (sessionSaved) return "local_storage_blocked";
    return "storage_blocked";
  }

  function classifyDebugPayload(payload) {
    var utmCount = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_id",
      "utm_content",
      "utm_term"
    ].filter(function (key) {
      return payload[key];
    }).length;
    var hasClickId = Boolean(
      payload.fbclid ||
      payload.gclid ||
      payload.ttclid ||
      payload.msclkid ||
      payload.wbraid ||
      payload.gbraid
    );
    var hasMetaIds = Boolean(
      payload.meta_campaign_id ||
      payload.meta_adset_id ||
      payload.meta_ad_id
    );
    var hasReferrer = Boolean(payload.referrer || payload.current_page_url || payload.landing_page_url);

    if (utmCount >= 3) {
      return { tracking_status: "complete_utm", audit_reason: "utm_found_on_parent_url" };
    }

    if (utmCount > 0) {
      return { tracking_status: "partial_utm", audit_reason: "iframe_received_parent_payload" };
    }

    if (hasClickId || hasMetaIds) {
      return { tracking_status: "click_id_only", audit_reason: "fbclid_found_without_utm" };
    }

    if (payload.source_capture_method === "parent_embed_script_local_storage_recovered") {
      return { tracking_status: "storage_recovered", audit_reason: "recovered_from_local_storage" };
    }

    if (payload.source_capture_method === "parent_embed_script_session_storage_recovered") {
      return { tracking_status: "storage_recovered", audit_reason: "recovered_from_session_storage" };
    }

    if (hasReferrer) {
      return { tracking_status: "referrer_only", audit_reason: "organic_assigned_due_to_no_tracking_signal" };
    }

    return { tracking_status: "organic_unknown", audit_reason: "no_url_params_no_storage" };
  }

  try {
    var script = document.currentScript;
    if (!script) return;

    var formToken = script.getAttribute("data-form-token") || "";
    var brand = script.getAttribute("data-brand") || "";
    var formId = script.getAttribute("data-form-id") || "";
    if (!formToken) {
      console.error("[LaunchHub] Missing required data-form-token on embed script.");
      return;
    }
    var targetId = script.getAttribute("data-target-id") || "";
    var targetSelector = script.getAttribute("data-target") || "";
    var pixelId = (script.getAttribute("data-pixel-id") || "").trim();
    var pixelEventValue = getPixelValue(
      script.getAttribute("data-pixel-event-value"),
      388
    );
    var pixelCurrency = getPixelCurrency(
      script.getAttribute("data-pixel-currency")
    );
    var conversionMode = getConversionMode(
      script.getAttribute("data-conversion-mode")
    );
    var successRedirectUrl = (
      script.getAttribute("data-success-redirect-url") || ""
    ).trim();
    var lazyLoad = isLazyLoadEnabled(script.getAttribute("data-lazy-load"));
    var lazyRootMargin = getLazyRootMargin(
      script.getAttribute("data-lazy-root-margin")
    );
    var conversionBeaconSent = false;
    var successRedirectStarted = false;
    var iframeLoaded = false;
    var height = clampEmbedHeight(script.getAttribute("data-height") || "500");
    var scriptOrigin = new URL(script.src).origin;
    var embedOrigin = scriptOrigin;
    var parentPageUrl = getRealParentPageUrl();
    var parentOrigin = getOrigin(parentPageUrl) || window.location.origin;
    var localKey = "alyssa_first_touch";
    var sessionKey = "alyssa_latest_touch";
    var searchParams = mergeSearchParams(parentPageUrl, window.location.search);
    var visitorId =
      readStorage("alyssa_visitor_id", window.localStorage) ||
      createId("vis");
    var sessionId =
      readStorage("alyssa_session_id", window.sessionStorage) ||
      createId("ses");

    var paramPayload = pickParams(searchParams);
    var firstStored = readStorage(localKey, window.localStorage);
    var latestStored = readStorage(sessionKey, window.sessionStorage);
    var hasCurrentParams = hasKeys(paramPayload);
    var captureMethod = hasCurrentParams
      ? "parent_embed_script"
      : latestStored
        ? "parent_embed_script_session_storage_recovered"
        : firstStored
          ? "parent_embed_script_local_storage_recovered"
          : "parent_embed_script_no_tracking_signal";

    var basePayload = {
      source_capture_method: captureMethod,
      visitor_id: visitorId,
      session_id: sessionId,
      brand: brand,
      form_id: formId,
      parent_origin: parentOrigin,
      referrer: document.referrer || "",
      landing_page_url: firstStored && firstStored.landing_page_url ? firstStored.landing_page_url : parentPageUrl,
      current_page_url: parentPageUrl,
      page_path: getPathname(parentPageUrl),
      page_title: document.title || "",
      captured_at: new Date().toISOString()
    };
    var latestTouch = Object.assign({}, basePayload, latestStored || {}, paramPayload, {
      source_capture_method: captureMethod
    });
    var firstTouch = firstStored || Object.assign({}, basePayload, paramPayload);
    var localSaved = writeStorage(localKey, firstTouch, window.localStorage);
    var sessionSaved = writeStorage(sessionKey, latestTouch, window.sessionStorage);
    writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
    writeStorage("alyssa_session_id", sessionId, window.sessionStorage);

    var debugClassification = classifyDebugPayload(latestTouch);
    var submittedTouch = Object.assign({}, latestTouch, {
      source_capture_method: captureMethod,
      storage_status: classifyStorageStatus(localSaved, sessionSaved),
      tracking_status: debugClassification.tracking_status,
      audit_reason: debugClassification.audit_reason
    });
    var debugPayload = {
      submitted_touch_json: submittedTouch,
      tracking_status: debugClassification.tracking_status,
      audit_reason: debugClassification.audit_reason
    };

    window.__ALYSSA_LEAD_CAPTURE_DEBUG__ = debugPayload;

    try {
      window.dispatchEvent(
        new CustomEvent("alyssa:attribution-captured", { detail: debugPayload })
      );
    } catch {
    }

    var iframeUrl = new URL(embedOrigin + "/embed/" + encodeURIComponent(formToken));
    if (brand) iframeUrl.searchParams.set("brand", brand);
    if (formId) iframeUrl.searchParams.set("form_id", formId);
    if (conversionMode) iframeUrl.searchParams.set("conversion_mode", conversionMode);
    if (successRedirectUrl) {
      iframeUrl.searchParams.set("success_redirect_url", successRedirectUrl);
    }
    Object.keys(paramPayload).forEach(function (key) {
      iframeUrl.searchParams.set(key, paramPayload[key]);
    });
    iframeUrl.searchParams.set("parent_url", parentPageUrl);
    iframeUrl.searchParams.set("parent_origin", parentOrigin);

    var iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = String(height);
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.minHeight = "480px";
    iframe.style.height = height + "px";
    iframe.style.overflow = "hidden";
    iframe.style.display = "block";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("title", "Campaign registration form");

    function loadIframe(container, placeholder) {
      if (iframeLoaded) return;
      iframeLoaded = true;
      iframe.src = iframeUrl.toString();

      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.replaceChild(iframe, placeholder);
      } else if (container && !iframe.parentNode) {
        container.appendChild(iframe);
      } else if (script.parentNode && !iframe.parentNode) {
        script.parentNode.insertBefore(iframe, script.nextSibling);
      }
    }

    function setupLazyLoad(container, placeholder) {
      if (!("IntersectionObserver" in window)) {
        loadIframe(container, placeholder);
        return;
      }

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            loadIframe(container, placeholder);
          });
        },
        { rootMargin: lazyRootMargin }
      );

      observer.observe(placeholder || container);
    }

    function sendAttribution() {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        {
          type: "alyssa_attribution_payload",
          payload: {
            first_touch_json: firstTouch,
            latest_touch_json: latestTouch,
            submitted_touch_json: submittedTouch
          }
        },
        embedOrigin
      );
    }

    function fireCompleteRegistrationBeacon(message) {
      if (conversionMode === "thank_you_redirect") return;
      if (!pixelId || conversionBeaconSent) return;

      conversionBeaconSent = true;

      var beaconUrl = createCompleteRegistrationBeaconUrl({
        pixelId: pixelId,
        pageUrl: getPixelLandingUrl(parentPageUrl),
        value: getPixelValue(message && message.value, pixelEventValue),
        currency: getPixelCurrency(
          (message && message.currency) || pixelCurrency
        )
      });
      var beacon = new Image();
      beacon.src = beaconUrl;
    }

    iframe.addEventListener("load", sendAttribution);
    window.addEventListener("message", function (event) {
      if (event.origin !== embedOrigin) return;
      if (
        event.data &&
        event.data.type === "launchhub:resize" &&
        event.data.source === "launchhub-form" &&
        (!event.data.formToken || event.data.formToken === formToken)
      ) {
        var nextHeight = clampEmbedHeight(event.data.height);
        iframe.height = String(nextHeight);
        iframe.style.height = nextHeight + "px";
      }
      if (event.data && event.data.type === "alyssa_iframe_ready") {
        sendAttribution();
      }
      if (
        event.data &&
        event.data.type === "launchhub:success-redirect" &&
        event.data.source === "launchhub-form" &&
        event.data.formToken === formToken
      ) {
        if (successRedirectStarted) return;
        successRedirectStarted = true;

        var finalRedirectUrl = event.data.redirectUrl || successRedirectUrl;
        var redirected = navigateTopToSuccessUrl(finalRedirectUrl, brand);

        if (!redirected && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "launchhub:redirect-blocked",
              source: "launchhub-embed",
              redirectUrl: isAllowedSuccessRedirectUrl(finalRedirectUrl, brand)
                ? finalRedirectUrl
                : ""
            },
            embedOrigin
          );
        }
      }
      if (
        event.data &&
        event.data.type === "launchhub:form-submitted" &&
        event.data.event === "CompleteRegistration"
      ) {
        fireCompleteRegistrationBeacon(event.data);

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(event.data, "*");
        }
        if (
          window.top &&
          window.top !== window &&
          window.top !== window.parent
        ) {
          window.top.postMessage(event.data, "*");
        }
      }
    });

    var target = targetId ? document.getElementById(targetId) : null;
    if (!target && targetSelector) {
      try {
        target = document.querySelector(targetSelector);
      } catch {
        target = null;
      }
    }
    if (target) {
      target.innerHTML = "";
      if (lazyLoad) {
        var targetPlaceholder = createPlaceholder();
        target.appendChild(targetPlaceholder);
        setupLazyLoad(target, targetPlaceholder);
      } else {
        target.appendChild(iframe);
        loadIframe(target);
      }
    } else if (script.parentNode) {
      if (lazyLoad) {
        var inlinePlaceholder = createPlaceholder();
        script.parentNode.insertBefore(inlinePlaceholder, script.nextSibling);
        setupLazyLoad(null, inlinePlaceholder);
      } else {
        script.parentNode.insertBefore(iframe, script.nextSibling);
        loadIframe(null);
      }
    }
  } catch (error) {
    console.error("[LaunchHub] Embed failed:", error);
  }
})();
