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
- With the Synapse Server-Side Tracking plugin on the page, pixels are sent with
  fetch keepalive, so events fired while the page closes still arrive.
- A blocked pixel is retried once in a disguised form that the Synapse edge
  worker or the Synapse Client unpacks.
- Only events that need it (MD5, the data layer, GA4 parameters, the response
  push or server commands, events too large for a pixel) load `sender.js` from
  this repository. If it cannot load, the event still goes as a pixel, marked
  `_synr=2` so the Synapse logs count it as rescued.

## Before you start

- A server-side GTM container that answers on an address of its own.
- The [Synapse Client](https://github.com/synapse-marketing/synapse-client)
  imported into that container and published.

## Set up the tag

1. In the web container open Templates, Tag Templates, New, then the menu and
   Import. Choose `template.tpl` and save the template.
2. Create a new tag and choose Synapse Tag as its type.
3. Under **Event Name** choose **Standard** and pick an event from the list,
   or choose **Custom** and type a name.
4. In **GTM Server Side URL** enter the address of the server container, for
   example `https://sgtm.example.com`. If the site uses the Synapse edge
   worker, enter the path on your own domain instead, for example
   `https://example.com/your-path`.
5. Add a trigger, save the tag and publish the container.

Create one tag for each event you send. The other fields can stay as they are.

## Fields

- **Send all from Data Layer** adds every value of the data layer to the
  event. With **Use own Data Model** the values are rebuilt from the pushes up
  to the event that fired the tag.
  **Send the current Data Layer event object data only** sends just the push
  that fired the tag.
- **Send common data** adds page_location, page_hostname, page_referrer,
  page_title and page_encoding. A POST request also adds screen_resolution and
  viewport_size.
- **Add consent state** adds the Google consent mode status to the event as
  `consent_state`. The Synapse Client uses it to decide whether it may write
  its cookies and whether it may add stored user data to the event.
- **Add Common Cookie** adds the click and browser IDs that advertising
  platforms keep in first-party cookies, as `common_cookie`.
- **Event Data** and **User Data** are tables of rows with a name and a value.
  **Transformation** can trim the value, turn it to lower case, encode it as
  Base64 or hash it with MD5 or SHA-256. **Store** keeps the value in the
  browser for later events: in the `synapse` cookie, in local storage or in
  both.
- **Request Type**, under **Settings**: **Auto** sends the event as a pixel
  whenever possible and as a POST request only when the event needs one.
  **POST** always sends through the sender script, **GET** always as a pixel.
- **Path** is the path the Synapse Client listens on. Keep `/data` unless
  the client is set up with a different path.
- **Protocol version** is the version of the request format. Keep the default.
- **Synapse Tag Script URL** is the address of the script that sends POST
  requests. By default it is loaded from this repository through jsDelivr.
- **Add GA4 specific parameters** adds what a GA4 client expects, with the
  **Measurement ID** you enter, so the event can also be processed as a GA4
  hit.
- **Push event to DataLayer after tag receives a response** pushes the answer
  of the server to the data layer, as an event with the name you enter in
  **DataLayer Event Name**. **DataLayer Object Name** is the global name of
  the data layer: `dataLayer`, unless the site uses another.
- **Support rich command protocol** lets the server container answer with
  commands for the browser, for example pixels to load.
  **Wait for cookies before event is pushed** holds the push of the response
  until the cookie pixels sent by the server have loaded.
- **Use fetch instead of XMLHttpRequest (for POST requests only)** sends POST
  requests with fetch and keepalive, which also delivers events fired while
  the page is closing.

## Check the setup

Open the preview of the web container and fire the event. The tag shows as
succeeded, and the network panel of the browser shows the request to the
address you entered.

Copyright 2026 Synapse. Apache License 2.0, see [LICENSE](LICENSE).
