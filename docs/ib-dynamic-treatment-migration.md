# IB Dynamic Treatment Migration

Status: implementation in progress

## Goal

Replace one-off Wix treatment pages with a shared CMS-driven Dynamic Treatment Page while keeping LaunchHub form attribution, Meta conversion tracking, and safe thank-you redirects.

## Wix CMS

Collection: `IBTreatments`

Required cross-system fields:

- `offerKey`
- `title`
- `slug`
- `dynamicUrl`
- `price`
- `currency`
- `formToken`
- `formId`
- `pixelId`
- `pixelValue`
- `successRedirect`
- `mappingStatus`

## Dynamic form contract

The Wix page sends the current CMS item to the HTML component using `postMessage`:

```js
$w('#launchHubFormHtml').postMessage({
  type: 'launchhub:configure-form',
  payload: {
    targetId: 'launchhub-dynamic-form-root',
    formToken: item.formToken,
    brand: 'ineffable',
    formId: item.formId,
    pixelId: item.pixelId,
    pixelEventValue: item.pixelValue,
    pixelCurrency: item.currency || 'HKD',
    conversionMode: 'thank_you_redirect',
    successRedirectUrl: item.successRedirect,
    height: 760,
    debug: false
  }
});
```

The HTML component contains one permanent loader:

```html
<div id="launchhub-dynamic-form-root"></div>
<script src="https://go.beautytrialhk.com/embed/launchhub-dynamic-form.js"></script>
```

The loader validates the payload, injects `alyssa-form.js`, and prevents stale form instances when a Dynamic Page item changes.

## Migration guardrails

- Keep all CMS records as `migration-draft` until the shared template is validated.
- Do not create redirects before the new dynamic URLs are live.
- Do not remove legacy pages before form submission, attribution, redirect, and mobile QA pass.
- Missing `formToken` must render a safe configuration message rather than a broken iframe.
- Allowed Ineffable success redirects remain restricted to `https://www.ineffablebeautyhk.com/thank-you`.

## Mapping states

- `redirect-ready-form-mapping-pending`
- `form-and-redirect-mapped-pending-template`
- `template-connected-pending-qa`
- `qa-passed-ready-for-cutover`
- `live`
