(function () {
  var CONFIG_EVENT = "launchhub:configure-form";
  var READY_EVENT = "launchhub:dynamic-loader-ready";
  var ERROR_EVENT = "launchhub:dynamic-loader-error";
  var EMBED_SRC = "https://go.beautytrialhk.com/embed/alyssa-form.js";
  var DEFAULT_TARGET_ID = "launchhub-dynamic-form-root";
  var currentScript = null;
  var currentKey = "";

  function sendToParent(type, detail) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: type,
            source: "launchhub-dynamic-form",
            detail: detail || {}
          },
          "*"
        );
      }
    } catch {
    }
  }

  function showMessage(target, message) {
    target.innerHTML = "";
    var box = document.createElement("div");
    box.setAttribute("role", "status");
    box.style.boxSizing = "border-box";
    box.style.width = "100%";
    box.style.padding = "18px";
    box.style.border = "1px solid rgba(216, 91, 163, 0.18)";
    box.style.borderRadius = "18px";
    box.style.background = "rgba(255, 248, 252, 0.82)";
    box.style.color = "#7b5a6a";
    box.style.font = "600 13px/1.6 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    box.style.textAlign = "center";
    box.textContent = message;
    target.appendChild(box);
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function safeNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function normalizeConfig(input) {
    var value = input && typeof input === "object" ? input : {};
    return {
      targetId: cleanText(value.targetId) || DEFAULT_TARGET_ID,
      formToken: cleanText(value.formToken),
      brand: cleanText(value.brand) || "ineffable",
      formId: cleanText(value.formId),
      pixelId: cleanText(value.pixelId),
      pixelEventValue: safeNumber(value.pixelEventValue, 0),
      pixelCurrency: cleanText(value.pixelCurrency).toUpperCase() || "HKD",
      conversionMode:
        value.conversionMode === "thank_you_redirect"
          ? "thank_you_redirect"
          : "form_submit_pixel",
      successRedirectUrl: cleanText(value.successRedirectUrl),
      height: safeNumber(value.height, 760),
      debug: value.debug === true || value.debug === 1 || value.debug === "1"
    };
  }

  function getConfigKey(config) {
    return [
      config.formToken,
      config.formId,
      config.pixelId,
      String(config.pixelEventValue),
      config.pixelCurrency,
      config.conversionMode,
      config.successRedirectUrl
    ].join("|");
  }

  function removeCurrentScript() {
    if (currentScript && currentScript.parentNode) {
      currentScript.parentNode.removeChild(currentScript);
    }
    currentScript = null;
  }

  function configure(input) {
    var config = normalizeConfig(input);
    var target = document.getElementById(config.targetId);

    if (!target) {
      sendToParent(ERROR_EVENT, {
        code: "TARGET_NOT_FOUND",
        targetId: config.targetId
      });
      return;
    }

    if (!config.formToken) {
      removeCurrentScript();
      currentKey = "";
      showMessage(target, "表格資料尚未完成設定，請稍後再試或直接 WhatsApp 聯絡我們。");
      sendToParent(ERROR_EVENT, {
        code: "MISSING_FORM_TOKEN",
        targetId: config.targetId
      });
      return;
    }

    var nextKey = getConfigKey(config);
    if (nextKey === currentKey && target.querySelector("iframe")) {
      return;
    }

    removeCurrentScript();
    currentKey = nextKey;
    target.innerHTML = "";

    var script = document.createElement("script");
    script.src = EMBED_SRC + "?v=dynamic-treatment-20260720";
    script.async = true;
    script.setAttribute("data-form-token", config.formToken);
    script.setAttribute("data-brand", config.brand);
    if (config.formId) script.setAttribute("data-form-id", config.formId);
    if (config.pixelId) script.setAttribute("data-pixel-id", config.pixelId);
    script.setAttribute("data-pixel-event-value", String(config.pixelEventValue));
    script.setAttribute("data-pixel-currency", config.pixelCurrency);
    script.setAttribute("data-conversion-mode", config.conversionMode);
    if (config.successRedirectUrl) {
      script.setAttribute("data-success-redirect-url", config.successRedirectUrl);
    }
    script.setAttribute("data-height", String(config.height));
    script.setAttribute("data-target", "#" + config.targetId);
    if (config.debug) script.setAttribute("data-debug", "1");

    script.addEventListener("error", function () {
      showMessage(target, "表格暫時未能載入，請重新整理頁面或直接 WhatsApp 聯絡我們。");
      sendToParent(ERROR_EVENT, {
        code: "EMBED_SCRIPT_LOAD_FAILED",
        formToken: config.formToken
      });
    });

    currentScript = script;
    document.body.appendChild(script);
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== CONFIG_EVENT) return;
    configure(event.data.payload || {});
  });

  window.LaunchHubDynamicForm = {
    configure: configure
  };

  sendToParent(READY_EVENT, {
    targetId: DEFAULT_TARGET_ID
  });
})();
