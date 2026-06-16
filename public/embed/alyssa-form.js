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
    "ctwa_id",
    "meta_ad_id",
    "meta_adset_id",
    "meta_campaign_id"
  ];

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
    ATTRIBUTION_KEYS.forEach(function (key) {
      var value = searchParams.get(key);
      if (value) output[key] = value;
    });
    return output;
  }

  function hasKeys(value) {
    return value && Object.keys(value).length > 0;
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
    var hasReferrer = Boolean(payload.referrer || payload.current_page_url || payload.landing_page_url);

    if (utmCount >= 3) {
      return { tracking_status: "complete_utm", audit_reason: "utm_found_on_parent_url" };
    }

    if (utmCount > 0) {
      return { tracking_status: "partial_utm", audit_reason: "iframe_received_parent_payload" };
    }

    if (hasClickId) {
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

    var formToken = script.getAttribute("data-form-token") || "alyssa-main-form-dev-token";
    var brand = script.getAttribute("data-brand") || "alyssa";
    var formId = script.getAttribute("data-form-id") || "alyssa-main-form";
    var targetId = script.getAttribute("data-target-id") || "";
    var height = script.getAttribute("data-height") || "820";
    var scriptOrigin = new URL(script.src).origin;
    var embedOrigin = scriptOrigin;
    var parentOrigin = window.location.origin;
    var localKey = "alyssa_first_touch";
    var sessionKey = "alyssa_latest_touch";
    var searchParams = new URLSearchParams(window.location.search);
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
      landing_page_url: firstStored && firstStored.landing_page_url ? firstStored.landing_page_url : window.location.href,
      current_page_url: window.location.href,
      page_path: window.location.pathname,
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
    iframeUrl.searchParams.set("brand", brand);
    iframeUrl.searchParams.set("form_id", formId);
    iframeUrl.searchParams.set("parent_origin", parentOrigin);

    var iframe = document.createElement("iframe");
    iframe.src = iframeUrl.toString();
    iframe.width = "100%";
    iframe.height = height;
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.display = "block";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", "Campaign registration form");

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

    iframe.addEventListener("load", sendAttribution);
    window.addEventListener("message", function (event) {
      if (event.origin !== embedOrigin) return;
      if (event.data && event.data.type === "alyssa_iframe_ready") {
        sendAttribution();
      }
    });

    var target = targetId ? document.getElementById(targetId) : null;
    if (target) {
      target.innerHTML = "";
      target.appendChild(iframe);
    } else if (script.parentNode) {
      script.parentNode.insertBefore(iframe, script.nextSibling);
    }
  } catch (error) {
    console.error("[LaunchHub] Embed failed:", error);
  }
})();
