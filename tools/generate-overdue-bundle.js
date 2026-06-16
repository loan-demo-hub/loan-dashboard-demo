var fso = new ActiveXObject("Scripting.FileSystemObject");
var demo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName));
var outPath = demo + "\\js\\overdueReasonTagsBundle.js";

function readText(path) {
  var stream = new ActiveXObject("ADODB.Stream");
  stream.Type = 2;
  stream.Charset = "utf-8";
  stream.Open();
  stream.LoadFromFile(path);
  var text = stream.ReadText();
  stream.Close();
  return text;
}

function parseScalar(raw) {
  var v = String(raw).replace(/^\s+|\s+$/g, "");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') || (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) {
    return v.slice(1, -1);
  }
  return v;
}

function parse(text) {
  var lines = text.replace(/\r\n/g, "\n").split("\n");
  var root = {};
  var stack = [{ indent: -1, obj: root, isArray: false }];
  var blockKey = null;
  var blockIndent = 0;
  var blockLines = [];

  function current() {
    return stack[stack.length - 1].obj;
  }

  function commitBlock() {
    if (blockKey === null) return;
    current()[blockKey] = blockLines.join("\n").replace(/\n+$/, "");
    blockKey = null;
    blockLines = [];
  }

  function popTo(indent) {
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
  }

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line.replace(/\s/g, "").length || line.replace(/^\s+/, "").indexOf("#") === 0) continue;

    var indent = line.search(/\S/);
    var trimmed = line.replace(/^\s+/, "");

    if (blockKey !== null) {
      if (indent > blockIndent) {
        blockLines.push(line.slice(blockIndent + 2));
        continue;
      }
      commitBlock();
    }

    popTo(indent);

    if (trimmed.indexOf("- ") === 0) {
      var parent = stack[stack.length - 1].obj;
      if (!("[object Array]" === Object.prototype.toString.call(parent))) {
        throw new Error("YAML parse error at line " + (li + 1));
      }
      var item = trimmed.slice(2).replace(/^\s+|\s+$/g, "");
      if (item.indexOf(": ") >= 0) {
        var obj = {};
        var colonIdx = item.indexOf(": ");
        obj[item.slice(0, colonIdx).replace(/^\s+|\s+$/g, "")] = parseScalar(item.slice(colonIdx + 2));
        parent.push(obj);
        stack.push({ indent: indent, obj: obj, isArray: false });
      } else {
        parent.push(parseScalar(item));
      }
      continue;
    }

    if (trimmed.charAt(trimmed.length - 1) === "|") {
      blockKey = trimmed.slice(0, -1).replace(/^\s+|\s+$/g, "");
      blockIndent = indent;
      blockLines = [];
      continue;
    }

    var colon = trimmed.indexOf(": ");
    if (colon === -1 && trimmed.charAt(trimmed.length - 1) === ":") {
      var keyOnly = trimmed.slice(0, -1);
      var nextIsList = false;
      for (var j = li + 1; j < lines.length; j++) {
        var nextLine = lines[j];
        if (!nextLine.replace(/\s/g, "").length || nextLine.replace(/^\s+/, "").indexOf("#") === 0) continue;
        var nextIndent = nextLine.search(/\S/);
        if (nextIndent <= indent) break;
        if (nextLine.replace(/^\s+/, "").indexOf("- ") === 0) nextIsList = true;
        break;
      }
      if (nextIsList) {
        var arr2 = [];
        current()[keyOnly] = arr2;
        stack.push({ indent: indent, obj: arr2, isArray: true });
      } else {
        var nested = {};
        current()[keyOnly] = nested;
        stack.push({ indent: indent, obj: nested, isArray: false });
      }
      continue;
    }

    if (colon === -1) continue;

    var key = trimmed.slice(0, colon).replace(/^\s+|\s+$/g, "");
    var rest = trimmed.slice(colon + 2).replace(/^\s+|\s+$/g, "");

    if (rest === "") {
      var arr3 = [];
      current()[key] = arr3;
      stack.push({ indent: indent, obj: arr3, isArray: true });
    } else if (rest === "[]") {
      current()[key] = [];
    } else {
      current()[key] = parseScalar(rest);
    }
  }

  commitBlock();
  return root;
}

var yamlPath = demo + "\\mock-data\\overdue_reason_tags.yaml";
var parsed = parse(readText(yamlPath));

function jsonStringify(value) {
  if (value === null || value === undefined) return "null";
  var t = typeof value;
  if (t === "boolean" || t === "number") return String(value);
  if (t === "string") {
    return (
      '"' +
      value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t") +
      '"'
    );
  }
  if (Object.prototype.toString.call(value) === "[object Array]") {
    var items = [];
    for (var i = 0; i < value.length; i++) items.push(jsonStringify(value[i]));
    return "[" + items.join(",") + "]";
  }
  var pairs = [];
  for (var k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k)) {
      pairs.push(jsonStringify(String(k)) + ":" + jsonStringify(value[k]));
    }
  }
  return "{" + pairs.join(",") + "}";
}

var json = jsonStringify(parsed);
var js =
  "/** Pre-parsed overdue reason tags — static hosting fallback */\n" +
  "window.__MOCK_DATA_BUNDLE__ = window.__MOCK_DATA_BUNDLE__ || {};\n" +
  'window.__MOCK_DATA_BUNDLE__["mock-data/overdue_reason_tags.yaml"] = ' +
  json +
  ";\n";

var stream = new ActiveXObject("ADODB.Stream");
stream.Type = 2;
stream.Charset = "utf-8";
stream.Open();
stream.WriteText(js);
stream.SaveToFile(outPath, 2);
stream.Close();
WScript.Echo("Wrote " + outPath + " tags=" + (parsed.tags ? parsed.tags.length : 0));
