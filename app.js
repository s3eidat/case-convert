/* Case Convert — every conversion runs locally, one line at a time. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;

  var SMALL = new Set("a an and as at but by en for from if in into nor of off on onto or over per the to up via vs vs. with".split(" "));
  var up = function (s) { return s.toLocaleUpperCase(); }, low = function (s) { return s.toLocaleLowerCase(); };
  function capFirst(w) { var c = Array.from(w); return c.length ? up(c[0]) + c.slice(1).join("") : w; }

  // Words for code-style cases: split on anything that isn't a letter/number, and on camelCase / ACRONYMWord boundaries.
  function codeWords(line) {
    return line
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
      .split(/[^\p{L}\p{N}\p{M}]+/u)
      .filter(Boolean);
  }

  function title(line) {
    var shouty = line === up(line) && line !== low(line);
    var parts = line.split(/(\s+)/), wordIdx = [];
    parts.forEach(function (p, i) { if (/\S/.test(p)) wordIdx.push(i); });
    var first = wordIdx[0], last = wordIdx[wordIdx.length - 1];
    return parts.map(function (p, i) {
      if (!/\S/.test(p)) return p;
      var prev = wordIdx[wordIdx.indexOf(i) - 1], afterColon = prev != null && /[:.!?—–]$/.test(parts[prev]);
      var w = shouty ? low(p) : p;
      var core = low(w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
      if (i !== first && i !== last && !afterColon && SMALL.has(core)) return low(w);
      // Keep deliberate mixed case (iPhone, McDonald, NASA) unless the whole line was shouting.
      if (!shouty && /\p{L}\p{Lu}/u.test(w)) return w;
      return w.split("-").map(function (seg) {
        return seg.replace(/^([^\p{L}\p{N}]*)(\p{L})(.*)$/u, function (m, pre, ch, rest) { return pre + up(ch) + rest; });
      }).join("-");
    }).join("");
  }

  function sentence(line) {
    var s = low(line).replace(/(^\s*[^\p{L}\p{N}]*|[.!?؟]\s+[^\p{L}\p{N}]*)(\p{L})/gu, function (m, pre, ch) { return pre + up(ch); });
    return s.replace(/(^|[^\p{L}\p{N}'’])i(?=$|[^\p{L}\p{N}])/gu, "$1I"); // the pronoun "i" → "I"
  }

  function alternate(line) {
    var n = 0;
    return Array.from(line).map(function (c) {
      if (low(c) === up(c)) return c; // not a cased letter
      return n++ % 2 ? up(c) : low(c);
    }).join("");
  }
  function inverse(line) {
    return Array.from(line).map(function (c) { return c === up(c) ? low(c) : up(c); }).join("");
  }

  var MODES = [
    ["upper", "UPPER CASE", up],
    ["lower", "lower case", low],
    ["title", "Title Case", title],
    ["sentence", "Sentence case", sentence],
    ["camel", "camelCase", function (l) { return codeWords(l).map(function (w, i) { return i ? capFirst(low(w)) : low(w); }).join(""); }],
    ["pascal", "PascalCase", function (l) { return codeWords(l).map(function (w) { return capFirst(low(w)); }).join(""); }],
    ["snake", "snake_case", function (l) { return codeWords(l).map(low).join("_"); }],
    ["kebab", "kebab-case", function (l) { return codeWords(l).map(low).join("-"); }],
    ["constant", "CONSTANT_CASE", function (l) { return codeWords(l).map(up).join("_"); }],
    ["alternate", "aLtErNaTe", alternate],
    ["inverse", "iNVERSE", inverse]
  ];
  var BY = {}; MODES.forEach(function (m) { BY[m[0]] = m; });

  function convert(text, mode) { return text.split("\n").map(BY[mode][2]).join("\n"); }

  // ---------- UI ----------
  var input = $("#input"), out = $("#out"), info = $("#info"), modesEl = $("#modes");
  var mode = BY[S3.store("case.mode")] ? S3.store("case.mode") : "title";

  MODES.forEach(function (m) {
    modesEl.appendChild(S3.h("button", { "class": "btn", type: "button", "data-v": m[0], "aria-pressed": String(m[0] === mode), text: m[1] }));
  });
  modesEl.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    mode = b.dataset.v; S3.store("case.mode", mode);
    $$("button", modesEl).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render(); if (input.value) S3.done();
  });

  function render() {
    var res = input.value ? convert(input.value, mode) : "";
    out.textContent = res;
    $("#modeName").textContent = BY[mode][1];
    var lines = input.value ? input.value.split("\n").length : 0;
    info.textContent = input.value ? lines + (lines === 1 ? " line, " : " lines, ") + Array.from(res).length.toLocaleString() + " characters" +
      (/[؀-ۿ]/.test(input.value) ? ". Arabic has no upper/lower case, so Arabic letters stay as they are." : "") : "";
  }

  input.addEventListener("input", S3.debounce(render, 120));
  $("#clear").addEventListener("click", function () { input.value = ""; render(); input.focus(); });
  $("#sample").addEventListener("click", function () {
    input.value = "the lord of the rings: the return of the king\nhow to build an iPhone app in a weekend\nuser account ID\nXMLParser handler\nmax retry count";
    render();
  });
  $("#copy").addEventListener("click", function () {
    if (!out.textContent) { S3.toast("Nothing to copy yet", "error"); return; }
    S3.copy(out.textContent); S3.done();
  });
  $("#use").addEventListener("click", function () { if (out.textContent) { input.value = out.textContent; render(); } });

  input.value = "";
  render();

  window.S3_DEMO = function () { $("#sample").click(); };

  window.S3_SELFTEST = function () {
    var t = [
      [convert("the lord of the rings: the return of the king", "title"), "The Lord of the Rings: The Return of the King"],
      [convert("a tale OF two cities", "title"), "A Tale of Two Cities"],
      [convert("HOW TO WIN FRIENDS", "title"), "How to Win Friends"],
      [convert("my iPhone and self-driving cars", "title"), "My iPhone and Self-Driving Cars"],
      [convert("hello WORLD. how are you? i'm fine", "sentence"), "Hello world. How are you? I'm fine"],
      [convert("user account ID", "camel"), "userAccountId"],
      [convert("XMLParser handler", "snake"), "xml_parser_handler"],
      [convert("someVariableName", "kebab"), "some-variable-name"],
      [convert("max retry-count", "constant"), "MAX_RETRY_COUNT"],
      [convert("hello_world 2nd try", "pascal"), "HelloWorld2ndTry"],
      [convert("Hello, World!", "alternate"), "hElLo, WoRlD!"],
      [convert("Hello World", "inverse"), "hELLO wORLD"],
      [convert("line one\nline two", "upper"), "LINE ONE\nLINE TWO"],
      [convert("Straße", "upper"), "STRASSE"],
      [convert("café menu", "camel"), "caféMenu"],
      [convert("مرحبا بالعالم", "snake"), "مرحبا_بالعالم"],
      [convert("", "title"), ""]
    ];
    return t.every(function (p) { return p[0] === p[1]; });
  };
})();
