(function () {
  var ATTRIBUTION_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "fbclid",
    "fbp",
    "fbc",
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

  function readCookie(name) {
    var prefix = name + "=";
    try {
      var item = document.cookie
        .split(";")
        .map(function (cookie) {
          return cookie.trim();
        })
        .find(function (cookie) {
          return cookie.indexOf(prefix) === 0;
        });

      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    } catch {
      return "";
    }
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

  // LAUNCHHUB_ATTRIBUTION_BRIDGE_V2
  function mergeTouchPayload(base, incoming) {
    var output = normalizeAttributionFields(Object.assign({}, base || {}));
    var next = normalizeAttributionFields(Object.assign({}, incoming || {}));
    Object.keys(next).forEach(function (key) {
      var value = next[key];
      if (typeof value === "string") {
        if (value.trim()) output[key] = value.trim();
      } else if (value !== null && value !== undefined && typeof value !== "object") {
        output[key] = value;
      }
    });
    return normalizeAttributionFields(output);
  }

  function normalizeEnvelopePayload(value) {
    var envelope = value && typeof value === "object" ? value : {};
    return {
      first_touch_json: normalizeAttributionFields(envelope.first_touch_json || {}),
      latest_touch_json: normalizeAttributionFields(envelope.latest_touch_json || {}),
      submitted_touch_json: normalizeAttributionFields(envelope.submitted_touch_json || {})
    };
  }

  function envelopeHasTracking(envelope) {
    return [
      envelope && envelope.submitted_touch_json,
      envelope && envelope.latest_touch_json,
      envelope && envelope.first_touch_json
    ].some(function (touch) {
      if (!touch) return false;
      return ATTRIBUTION_KEYS.some(function (key) { return Boolean(touch[key]); });
    });
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

  function getLandingPageSlug(value) {
    try {
      var parts = new URL(value).pathname.split("/").filter(Boolean);
      return parts[0] === "lp" && parts[1] ? parts[1] : "";
    } catch {
      return "";
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
    if (!Number.isFinite(parsed)) return 420;
    return Math.max(380, Math.min(Math.ceil(parsed), 2200));
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

  function createPageViewBeaconUrl(options) {
    var params = new URLSearchParams();
    params.set("id", options.pixelId);
    params.set("ev", "PageView");
    params.set("noscript", "1");
    params.set("dl", options.pageUrl);

    if (document.referrer) params.set("rl", document.referrer);

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
      var isAlyssa = safeBrand === "alyssa" || safeBrand.indexOf("alyssa-") === 0;
      var isIneffable = safeBrand === "ineffable" || safeBrand === "ineffable-beauty";
      var allowedOrigin = isAlyssa
        ? url.origin === "https://www.alyssa.hk" ||
          url.origin === "https://alyssa.hk"
        : isIneffable
          ? url.origin === "https://www.ineffablebeautyhk.com" ||
            url.origin === "https://ineffablebeautyhk.com"
          : false;
      var allowedPath = isAlyssa ? path === "/thankyou" : path === "/thank-you";

      return url.protocol === "https:" && allowedOrigin && allowedPath;
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

    var debugEnabled = script.getAttribute("data-debug") === "1";
    function debugLog(message, data) {
      if (!debugEnabled) return;
      try {
        console.info("[LaunchHub Embed]", message, data || {});
      } catch {
      }
    }

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
    var pixelPageView =
      script.getAttribute("data-pixel-pageview") === "true";
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
    var height = clampEmbedHeight(script.getAttribute("data-height") || "420");
    var scriptOrigin = new URL(script.src).origin;
    var embedOrigin = scriptOrigin;
    var parentPageUrl = getRealParentPageUrl();
    var parentOrigin = getOrigin(parentPageUrl) || window.location.origin;
    var wixParentOrigin = getOrigin(document.referrer);
    var localKey = "alyssa_first_touch";
    var sessionKey = "alyssa_latest_touch";
    var searchParams = mergeSearchParams(parentPageUrl, window.location.search);
    var visitorId =
      readStorage("alyssa_visitor_id", window.localStorage) ||
      createId("vis");
    var sessionId =
      readStorage("alyssa_session_id", window.sessionStorage) ||
      createId("ses");

    function fireEmbedPageViewBeacon() {
      if (!pixelPageView || !pixelId) return;

      window.__LAUNCHHUB_META_PIXEL_PAGEVIEWS__ =
        window.__LAUNCHHUB_META_PIXEL_PAGEVIEWS__ || {};
      var pageViewKey = pixelId + ":" + parentPageUrl;
      if (window.__LAUNCHHUB_META_PIXEL_PAGEVIEWS__[pageViewKey]) return;

      window.__LAUNCHHUB_META_PIXEL_PAGEVIEWS__[pageViewKey] = true;
      var beacon = new Image();
      beacon.src = createPageViewBeaconUrl({
        pixelId: pixelId,
        pageUrl: getPixelLandingUrl(parentPageUrl)
      });
    }

    fireEmbedPageViewBeacon();

    var paramPayload = pickParams(searchParams);
    var fbpCookie = readCookie("_fbp");
    var fbcCookie = readCookie("_fbc");
    if (!paramPayload.fbp && fbpCookie) paramPayload.fbp = fbpCookie;
    if (!paramPayload.fbc && fbcCookie) paramPayload.fbc = fbcCookie;
    paramPayload = normalizeAttributionFields(paramPayload);
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
      form_token: formToken,
      parent_origin: parentOrigin,
      parent_url: parentPageUrl,
      referrer: document.referrer || "",
      landing_page_url: firstStored && firstStored.landing_page_url ? firstStored.landing_page_url : parentPageUrl,
      current_page_url: parentPageUrl,
      page_url: parentPageUrl,
      landing_page_slug: getLandingPageSlug(parentPageUrl),
      page_path: getPathname(parentPageUrl),
      page_title: document.title || "",
      client_event_id: createId("lh_evt"),
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
    function applyParentAttributionEnvelope(envelopeValue) {
      var envelope = normalizeEnvelopePayload(envelopeValue);
      if (!envelopeHasTracking(envelope)) return false;

      if (envelopeHasTracking({ first_touch_json: envelope.first_touch_json })) {
        firstTouch = envelope.first_touch_json;
      }
      latestTouch = mergeTouchPayload(latestTouch, envelope.latest_touch_json);
      submittedTouch = mergeTouchPayload(
        mergeTouchPayload(submittedTouch, envelope.latest_touch_json),
        envelope.submitted_touch_json
      );
      submittedTouch.source_capture_method =
        submittedTouch.source_capture_method || "wix_page_code";
      latestTouch.source_capture_method =
        latestTouch.source_capture_method || "wix_page_code";

      parentPageUrl =
        submittedTouch.parent_url ||
        submittedTouch.current_page_url ||
        latestTouch.parent_url ||
        latestTouch.current_page_url ||
        parentPageUrl;
      parentOrigin =
        submittedTouch.parent_origin || getOrigin(parentPageUrl) || parentOrigin;

      writeStorage(localKey, firstTouch, window.localStorage);
      writeStorage(sessionKey, latestTouch, window.sessionStorage);
      var lockedTouch = hasKeys(submittedTouch) ? submittedTouch : latestTouch;
      writeStorage("launchhub_locked_attribution", lockedTouch, window.localStorage);
      writeStorage("launchhub_locked_attribution", lockedTouch, window.sessionStorage);

      if (typeof iframeUrl !== "undefined" && iframeUrl) {
        Object.keys(submittedTouch).forEach(function (key) {
          if (ATTRIBUTION_KEYS.indexOf(key) !== -1 && submittedTouch[key]) {
            iframeUrl.searchParams.set(key, submittedTouch[key]);
          }
        });
        if (parentPageUrl) iframeUrl.searchParams.set("parent_url", parentPageUrl);
        if (parentOrigin) iframeUrl.searchParams.set("parent_origin", parentOrigin);
      }

      debugClassification = classifyDebugPayload(submittedTouch);
      submittedTouch.tracking_status = debugClassification.tracking_status;
      submittedTouch.audit_reason = debugClassification.audit_reason;
      sendAttribution();
      return true;
    }

    function requestWixParentAttribution() {
      if (!window.parent || window.parent === window || !wixParentOrigin) return;
      window.parent.postMessage(
        {
          type: "launchhub_wix_attribution_ready",
          schema_version: 1,
          form_token: formToken
        },
        wixParentOrigin
      );
    }

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

    debugLog("resolved form iframe", {
      formToken: formToken,
      formId: formId,
      brand: brand,
      target: targetSelector || targetId || "inline",
      lazyLoad: lazyLoad,
      parentOrigin: parentOrigin
    });

    var iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = String(height);
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.minWidth = "0";
    iframe.style.minHeight = "420px";
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
      debugLog("loading iframe", { formToken: formToken });

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
      var envelope = {
        first_touch_json: firstTouch,
        latest_touch_json: latestTouch,
        submitted_touch_json: submittedTouch
      };
      iframe.contentWindow.postMessage(
        { type: "alyssa_attribution_payload", payload: envelope },
        embedOrigin
      );
      iframe.contentWindow.postMessage(
        {
          type: "launchhub_attribution_payload",
          schema_version: 1,
          payload: envelope
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
      var data = event.data || {};
      var isWixAttributionMessage =
        event.source === window.parent &&
        (data.type === "launchhub_attribution_payload" ||
          data.type === "alyssa_attribution_payload");

      if (isWixAttributionMessage) {
        if (wixParentOrigin && event.origin !== wixParentOrigin) return;
        if (data.schema_version !== undefined && data.schema_version !== 1) return;
        applyParentAttributionEnvelope(data.payload || {});
        return;
      }

      if (event.origin !== embedOrigin || event.source !== iframe.contentWindow) return;
      if (
        data.type === "launchhub:resize" &&
        data.source === "launchhub-form" &&
        (!data.formToken || data.formToken === formToken)
      ) {
        var nextHeight = clampEmbedHeight(data.height);
        iframe.height = String(nextHeight);
        iframe.style.height = nextHeight + "px";
      }
      if (
        data.type === "alyssa_iframe_ready" ||
        data.type === "launchhub_iframe_ready"
      ) {
        sendAttribution();
      }
      if (
        data.type === "launchhub:success-redirect" &&
        data.source === "launchhub-form" &&
        data.formToken === formToken
      ) {
        if (successRedirectStarted) return;
        successRedirectStarted = true;

        var finalRedirectUrl = data.redirectUrl || successRedirectUrl;
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
        data.type === "launchhub:form-submitted" &&
        data.event === "CompleteRegistration"
      ) {
        fireCompleteRegistrationBeacon(data);

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(data, wixParentOrigin || "*");
        }
        if (
          window.top &&
          window.top !== window &&
          window.top !== window.parent
        ) {
          window.top.postMessage(data, wixParentOrigin || "*");
        }
      }
    });
    requestWixParentAttribution();
    [250, 1000, 2500].forEach(function (delay) {
      window.setTimeout(requestWixParentAttribution, delay);
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
      debugLog("cleared target container", {
        formToken: formToken,
        target: targetSelector || targetId
      });
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
