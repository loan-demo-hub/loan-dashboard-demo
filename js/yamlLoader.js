/**
 * Minimal YAML loader — parses the subset used by mock-data/*.yaml only.
 */
const YamlLoader = (() => {
  let usedFallback = false;

  function wasFallbackUsed() {
    return usedFallback;
  }
  function parseScalar(raw) {
    const v = raw.trim();
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function parse(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const root = {};
    const stack = [{ indent: -1, obj: root, isArray: false }];
    let blockKey = null;
    let blockIndent = 0;
    let blockLines = [];

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

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line.trim() || line.trim().startsWith("#")) continue;

      const indent = line.search(/\S/);
      const trimmed = line.trim();

      if (blockKey !== null) {
        if (indent > blockIndent) {
          blockLines.push(line.slice(blockIndent + 2));
          continue;
        }
        commitBlock();
      }

      popTo(indent);

      if (trimmed.startsWith("- ")) {
        const parent = stack[stack.length - 1].obj;
        if (!Array.isArray(parent)) {
          throw new Error("YAML parse error: list item without array parent");
        }
        const item = trimmed.slice(2).trim();
        if (item.includes(": ")) {
          const obj = {};
          const colonIdx = item.indexOf(": ");
          const k = item.slice(0, colonIdx).trim();
          obj[k] = parseScalar(item.slice(colonIdx + 2));
          parent.push(obj);
          stack.push({ indent, obj, isArray: false });
        } else {
          parent.push(parseScalar(item));
        }
        continue;
      }

      if (trimmed.endsWith("|")) {
        blockKey = trimmed.slice(0, -1).trim();
        blockIndent = indent;
        blockLines = [];
        continue;
      }

      const colon = trimmed.indexOf(": ");
      if (colon === -1 && trimmed.endsWith(":")) {
        const key = trimmed.slice(0, -1);
        let nextIsList = false;
        for (let j = lineIndex + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (!nextLine.trim() || nextLine.trim().startsWith("#")) continue;
          const nextIndent = nextLine.search(/\S/);
          if (nextIndent <= indent) break;
          if (nextLine.trim().startsWith("- ")) nextIsList = true;
          break;
        }
        if (nextIsList) {
          const arr = [];
          current()[key] = arr;
          stack.push({ indent, obj: arr, isArray: true });
        } else {
          const obj = {};
          current()[key] = obj;
          stack.push({ indent, obj, isArray: false });
        }
        continue;
      }

      if (colon === -1) continue;

      const key = trimmed.slice(0, colon).trim();
      const rest = trimmed.slice(colon + 2).trim();

      if (rest === "") {
        const arr = [];
        current()[key] = arr;
        stack.push({ indent, obj: arr, isArray: true });
      } else if (rest === "[]") {
        current()[key] = [];
      } else {
        current()[key] = parseScalar(rest);
      }
    }

    commitBlock();
    return root;
  }

  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return parse(await res.text());
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function loadOffline(url) {
    const text = window.__YAML_FALLBACK__?.[url];
    if (text) {
      try {
        usedFallback = true;
        return parse(text);
      } catch {
        /* fallback parse failed — try bundle next */
      }
    }

    const bundle = window.__MOCK_DATA_BUNDLE__?.[url];
    if (bundle) {
      usedFallback = true;
      return cloneData(bundle);
    }

    throw new Error(`Cannot load ${url}`);
  }

  async function loadWithFallback(url) {
    if (location.protocol === "file:") {
      return loadOffline(url);
    }

    try {
      usedFallback = false;
      return await load(url);
    } catch {
      return loadOffline(url);
    }
  }

  return { load, loadWithFallback, parse, wasFallbackUsed };
})();
