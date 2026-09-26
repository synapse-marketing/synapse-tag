# Synapse Tag

Google Tag Manager web tag template that sends events to a server-side GTM
container running the [Synapse Client](https://github.com/synapse-marketing/synapse-client).

- Standard or custom event names, event data and user data with trim, lower
  case, base64, MD5 and SHA-256, values stored in a cookie or local storage for
  later events, page data, consent state, advertising cookies, the data layer,
  GA4 parameters, the server response pushed to the data layer and commands
  from the server.
- Hashing (SHA-256) runs inside the tag, so events with hashed user data go as
  first-party pixels that ad blockers, Brave and iOS let through.
- With the Synapse Conversion Tracking plugin on the page, pixels are sent with
  fetch keepalive, so events fired while the page closes still arrive.
- A blocked pixel is retried once in a disguised form that the Synapse edge
  worker or the Synapse Client unpacks.
- Only events that need it (MD5, the data layer, GA4 parameters, the response
  push or server commands, events too large for a pixel) load `sender.js` from
  this repository. If it cannot load, the event still goes as a pixel, marked
  `_synr=2` so the Synapse logs count it as rescued.

Import `template.tpl` in GTM: Templates, Tag Templates, New, menu, Import.

Copyright 2026 Synapse. Apache License 2.0, see [LICENSE](LICENSE).
