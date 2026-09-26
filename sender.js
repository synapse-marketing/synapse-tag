/*!
 * Synapse Tag sender script. Copyright 2026 Synapse. Apache License 2.0.
 *
 * Loaded by the Synapse Tag only for events that go as a POST. Exposes:
 *   synapseTagSendData  POST the event, handle the answer and server commands
 *   synapseTagGetData   page size and data layer values
 *   synapseTag256       SHA-256 as hex or base64
 *   synapseTagMD5       MD5 as hex
 */
(function (w) {
  'use strict';

  var STREAM_START = 'event: message\ndata: ';

  /* ---------------------------------------------------------------- hashing */

  function utf8Bytes(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code >= 0xd800 && code < 0xdc00 && i + 1 < text.length) {
        var next = text.charCodeAt(i + 1);
        if (next >= 0xdc00 && next < 0xe000) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i++;
        }
      }
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return bytes;
  }

  function hex(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
      out += i + 1 < bytes.length ? B64.charAt((n >> 6) & 63) : '=';
      out += i + 2 < bytes.length ? B64.charAt(n & 63) : '=';
    }
    return out;
  }

  // SHA-256, FIPS 180-4.
  var ROUND = [];
  var INITIAL = [];
  (function () {
    var found = 0;
    for (var candidate = 2; found < 64; candidate++) {
      var prime = true;
      for (var d = 2; d * d <= candidate; d++) {
        if (candidate % d === 0) {
          prime = false;
          break;
        }
      }
      if (!prime) continue;
      if (found < 8) INITIAL[found] = (Math.pow(candidate, 1 / 2) % 1) * 4294967296 | 0;
      ROUND[found] = (Math.pow(candidate, 1 / 3) % 1) * 4294967296 | 0;
      found++;
    }
  })();

  function sha256(bytes) {
    var length = bytes.length;
    var words = [];
    for (var i = 0; i < length; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[length >> 2] |= 0x80 << (24 - (length % 4) * 8);
    var total = ((length + 8) >> 6) * 16 + 16;
    for (var p = words.length; p < total; p++) words[p] = words[p] | 0;
    words[total - 1] = length * 8;
    words[total - 2] = Math.floor((length * 8) / 4294967296);
    var h = INITIAL.slice();
    var schedule = [];
    for (var block = 0; block < total; block += 16) {
      var a = h[0], b = h[1], c = h[2], e = h[4], f = h[5], g = h[6], dd = h[3], hh = h[7];
      for (var t = 0; t < 64; t++) {
        if (t < 16) {
          schedule[t] = words[block + t] | 0;
        } else {
          var x = schedule[t - 15];
          var y = schedule[t - 2];
          var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
          var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
          schedule[t] = (schedule[t - 16] + s0 + schedule[t - 7] + s1) | 0;
        }
        var sum1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var choice = (e & f) ^ (~e & g);
        var t1 = (hh + sum1 + choice + ROUND[t] + schedule[t]) | 0;
        var sum0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var majority = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (sum0 + majority) | 0;
        hh = g;
        g = f;
        f = e;
        e = (dd + t1) | 0;
        dd = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0;
      h[1] = (h[1] + b) | 0;
      h[2] = (h[2] + c) | 0;
      h[3] = (h[3] + dd) | 0;
      h[4] = (h[4] + e) | 0;
      h[5] = (h[5] + f) | 0;
      h[6] = (h[6] + g) | 0;
      h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    for (var k = 0; k < 8; k++) out.push((h[k] >>> 24) & 255, (h[k] >>> 16) & 255, (h[k] >>> 8) & 255, h[k] & 255);
    return out;
  }

  // MD5, RFC 1321.
  var SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  var SINES = [];
  for (var s = 0; s < 64; s++) SINES[s] = Math.floor(Math.abs(Math.sin(s + 1)) * 4294967296) | 0;

  function md5(bytes) {
    var length = bytes.length;
    var words = [];
    for (var i = 0; i < length; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[length >> 2] |= 0x80 << ((length % 4) * 8);
    var total = ((length + 8) >> 6) * 16 + 16;
    for (var p = words.length; p < total; p++) words[p] = words[p] | 0;
    words[total - 2] = length * 8;
    words[total - 1] = Math.floor((length * 8) / 4294967296);
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var block = 0; block < total; block += 16) {
      var a = a0, b = b0, c = c0, d = d0;
      for (var t = 0; t < 64; t++) {
        var f, g;
        if (t < 16) {
          f = (b & c) | (~b & d);
          g = t;
        } else if (t < 32) {
          f = (d & b) | (~d & c);
          g = (5 * t + 1) % 16;
        } else if (t < 48) {
          f = b ^ c ^ d;
          g = (3 * t + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          g = (7 * t) % 16;
        }
        var shift = SHIFTS[(t >> 4) * 4 + (t % 4)];
        var sum = (a + f + SINES[t] + (words[block + g] | 0)) | 0;
        a = d;
        d = c;
        c = b;
        b = (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0;
      }
      a0 = (a0 + a) | 0;
      b0 = (b0 + b) | 0;
      c0 = (c0 + c) | 0;
      d0 = (d0 + d) | 0;
    }
    var out = [];
    [a0, b0, c0, d0].forEach(function (word) {
      out.push(word & 255, (word >>> 8) & 255, (word >>> 16) & 255, (word >>> 24) & 255);
    });
    return out;
  }

  w.synapseTag256 = function (text, format) {
    var digest = sha256(utf8Bytes(String(text)));
    return format === 'B64' ? base64(digest) : hex(digest);
  };

  w.synapseTagMD5 = function (text) {
    return hex(md5(utf8Bytes(String(text))));
  };

  /* ---------------------------------------------------------------- data layer */

  var typeOf = function (value) {
    if (value === null || value === undefined) return String(value);
    var tag = Object.prototype.toString.call(value).slice(8, -1);
    return /^(Boolean|Number|String|Function|Array|Date|RegExp)$/.test(tag) ? tag.toLowerCase() : 'object';
  };
  var owns = function (object, key) {
    return Object.prototype.hasOwnProperty.call(Object(object), key);
  };
  var isArgs = function (value) {
    return !!value && (Object.prototype.toString.call(value) === '[object Arguments]' || owns(value, 'callee'));
  };
  var isPlain = function (value) {
    if (!value || typeOf(value) !== 'object' || value.nodeType || (value.window && value === value.window) || isArgs(value)) return false;
    try {
      if (value.constructor && !owns(value, 'constructor') && !owns(value.constructor.prototype, 'isPrototypeOf')) return false;
    } catch (e) {
      return false;
    }
    var last;
    for (last in value) {
      // the last enumerable key must be own for a plain object
    }
    return last === undefined || owns(value, last);
  };
  // The data layer's merge: arrays and plain objects deeply, anything else replaced.
  var mergeInto = function (source, target) {
    var result = target || (typeOf(source) === 'array' ? [] : {});
    for (var key in source) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' || !owns(source, key)) continue;
      var value = source[key];
      if (typeOf(value) === 'array') {
        if (typeOf(result[key]) !== 'array') result[key] = [];
        result[key] = mergeInto(value, result[key]);
      } else if (isPlain(value)) {
        if (!isPlain(result[key])) result[key] = {};
        result[key] = mergeInto(value, result[key]);
      } else {
        result[key] = value;
      }
    }
    return result;
  };
  var copyOf = function (value) {
    return typeOf(value) === 'array' || isPlain(value) ? mergeInto(value, null) : value;
  };
  var nested = function (dottedKey, value) {
    var root = {};
    var node = root;
    var parts = dottedKey.split('.');
    for (var i = 0; i < parts.length - 1; i++) node = node[parts[i]] = {};
    node[parts[parts.length - 1]] = value;
    return root;
  };
  // Pushes made through the GTM createQueue API arrive wrapped.
  var unwrap = function (entry) {
    if (entry && typeof entry === 'object' && !owns(entry, 'gtm.uniqueEventId') &&
      typeof entry.getUntrustedMessageValue === 'function' && typeof entry.value === 'object') {
      return entry.value;
    }
    return entry;
  };
  // gtag() commands arrive as arguments objects.
  var fromCommand = function (entry) {
    var command = entry[0];
    var result = null;
    if (command === 'js' && entry.length >= 2 && entry[1].getTime) {
      result = { event: 'gtm.js', 'gtm.start': entry[1].getTime() };
    } else if (command === 'set') {
      if (entry.length === 2 && isPlain(entry[1])) {
        result = copyOf(entry[1]);
      } else if (entry.length === 3 && typeof entry[1] === 'string') {
        result = {};
        result[entry[1]] = isPlain(entry[2]) || typeOf(entry[2]) === 'array' ? copyOf(entry[2]) : entry[2];
      }
    } else if (command === 'event' && entry.length >= 2 && typeof entry[1] === 'string') {
      result = { event: entry[1], eventModel: entry.length > 2 && isPlain(entry[2]) ? copyOf(entry[2]) : {} };
    }
    if (result && entry['gtm.uniqueEventId']) result['gtm.uniqueEventId'] = entry['gtm.uniqueEventId'];
    return result;
  };
  // Rebuilds the data model from the pushes, the way GTM builds it.
  var buildModel = function (entries) {
    try {
      if (!Array.isArray(entries)) return undefined;
      var model = {};
      for (var i = 0; i < entries.length; i++) {
        delete model.eventModel;
        var entry = entries[i];
        var isCommand = false;
        if (isArgs(entry)) {
          var command = fromCommand(entry);
          if (command) {
            isCommand = true;
            entry = command;
          }
        }
        entry = unwrap(entry);
        if (!isPlain(entry)) continue;
        var clear = isCommand || !!entry._clear;
        for (var key in entry) {
          if (!owns(entry, key) || key === '_clear') continue;
          if (clear) mergeInto(nested(key, undefined), model);
          mergeInto(nested(key, entry[key]), model);
        }
      }
      return model;
    } catch (e) {
      return undefined;
    }
  };
  var isEmpty = function (value) {
    if (typeof value !== 'object') return undefined;
    for (var key in value) if (owns(value, key)) return false;
    return true;
  };

  w.synapseTagGetData = function (containerId, eventId, ownModel, onlyCurrentPush) {
    var gtmLayer = w.google_tag_manager[containerId].dataLayer;
    var model = null;
    var currentPush = null;
    if (typeof eventId !== 'undefined' && (ownModel || onlyCurrentPush)) {
      try {
        var layer = w[gtmLayer.name];
        for (var i = layer.length - 1; i >= 0; i--) {
          var entry = layer[i];
          if (!entry || typeof entry !== 'object') continue;
          entry = unwrap(entry);
          if (eventId !== entry['gtm.uniqueEventId']) continue;
          if (ownModel) {
            model = buildModel(layer.slice(0, i + 1));
            if (typeof model !== 'object' || isEmpty(model)) model = null;
          } else if (onlyCurrentPush) {
            currentPush = entry;
          }
          break;
        }
      } catch (e) {
        // fall back to the model GTM keeps
      }
    }
    w.synapseTagData = {
      document: { characterSet: w.document.characterSet },
      innerWidth: w.innerWidth,
      innerHeight: w.innerHeight,
      screen: { width: w.screen.width, height: w.screen.height },
      dataModel: model || currentPush || gtmLayer.get({ split: function () { return []; } })
    };
    return w.synapseTagData;
  };

  /* ---------------------------------------------------------------- sending */

  var parseAnswer = function (text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return { body: text };
    }
  };

  w.synapseTagSendData = function (data, serverDomain, pathAndQuery, pushEventName, pushLayerName, waitForCookies, useFetch) {
    var shouldPush = !!(pushEventName && pushLayerName);
    var cookieBase = serverDomain.charAt(serverDomain.length - 1) === '/' ? serverDomain.slice(0, -1) : serverDomain;
    var pushData = {};
    var cookiesPending = 0;
    var request = null;

    var push = function () {
      w[pushLayerName] = w[pushLayerName] || [];
      pushData.event = pushEventName;
      w[pushLayerName].push(pushData);
    };
    var fillVariables = function (text) {
      return text.replace(/\$\{([^}]+)\}/g, function (all, name) {
        return name === 'transport_url' && serverDomain ? serverDomain : all;
      });
    };
    var loadPixel = function (src) {
      var image = new Image(1, 1);
      if (src.indexOf(cookieBase + '/_set_cookie') === 0) {
        cookiesPending++;
        image.onload = image.onerror = function () {
          image.onload = image.onerror = null;
          cookiesPending--;
          var answered = !request || request.readyState === 4;
          if (answered && shouldPush && waitForCookies && cookiesPending === 0) push();
        };
      }
      image.src = src;
    };
    var beacon = function (src) {
      var sent = false;
      try {
        sent = !!(navigator.sendBeacon && navigator.sendBeacon(src));
      } catch (e) {
        sent = false;
      }
      if (!sent) loadPixel(src);
    };
    // One message of the command stream: pixels, beacons and the tag's answer.
    var handleMessage = function (message) {
      if (!message) return;
      var i;
      if (Array.isArray(message.send_pixel)) for (i = 0; i < message.send_pixel.length; i++) loadPixel(message.send_pixel[i]);
      if (Array.isArray(message.send_beacon)) for (i = 0; i < message.send_beacon.length; i++) beacon(message.send_beacon[i]);
      if (typeof message.response === 'object') {
        var answer = parseAnswer(message.response.body || {});
        for (var key in answer) {
          if (Object.prototype.hasOwnProperty.call(answer, key)) pushData[key] = answer[key];
        }
        pushData.status = message.response.status_code || 0;
      }
    };
    var readStreamBlock = function (block) {
      var lines = block.split('\n');
      if (lines[0] && lines[0].indexOf('event: message') === 0 && lines[1] && lines[1].indexOf('data: ') === 0) {
        try {
          return JSON.parse(lines[1].substring(lines[1].indexOf(':') + 1));
        } catch (e) {
          return undefined;
        }
      }
      return undefined;
    };
    var finish = function (text, status) {
      if (!shouldPush) return;
      if (!text || text.indexOf(STREAM_START) !== 0) {
        pushData = parseAnswer(text);
        pushData.status = status;
        push();
      } else if (!waitForCookies || cookiesPending === 0) {
        push();
      }
    };
    var body = JSON.stringify(data);

    if (useFetch) {
      fetch(serverDomain + pathAndQuery, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        credentials: 'include',
        keepalive: true,
        body: body
      })
        .then(function (response) {
          response.text().then(function (text) {
            if (text) text = fillVariables(text);
            if (text && text.indexOf(STREAM_START) === 0) {
              text.split('\n\n').forEach(function (block) {
                if (!block) return;
                try {
                  handleMessage(JSON.parse(block.replace(STREAM_START, '')));
                } catch (e) {
                  if (w.console) w.console.error('Synapse Tag: unreadable server message', e);
                }
              });
            }
            finish(text, response.status);
          });
        })
        ['catch'](function (error) {
          if (w.console) w.console.error(error);
        });
      return;
    }

    request = new XMLHttpRequest();
    request.open('POST', serverDomain + pathAndQuery);
    request.setRequestHeader('Content-type', 'text/plain');
    request.withCredentials = true;
    var handled = 0;
    // Streamed commands are handled as they arrive, each one once.
    request.onprogress = function () {
      if (request.status !== 200 || request.responseText.indexOf(STREAM_START) !== 0) return;
      var text = fillVariables(request.responseText);
      var end = text.indexOf('\n\n', handled);
      while (end !== -1) {
        handleMessage(readStreamBlock(text.substring(handled, end)));
        handled = end + 2;
        end = text.indexOf('\n\n', handled);
      }
    };
    request.onload = function () {
      if (String(request.status).charAt(0) !== '2' && w.console) w.console.error(request.status + '> ' + request.statusText);
      finish(request.responseText, request.status);
    };
    request.send(body);
  };
})(window);
