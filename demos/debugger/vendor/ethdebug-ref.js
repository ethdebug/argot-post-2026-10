var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

var Memo;
((Memo2) => {
  Memo2.dereferencePointer = (pointer) => ({
    kind: "dereference-pointer",
    pointer
  });
  Memo2.saveRegions = (regions) => ({
    kind: "save-regions",
    regions
  });
  Memo2.saveVariables = (variables) => ({
    kind: "save-variables",
    variables
  });
  Memo2.restoreVariables = (variables) => ({
    kind: "restore-variables",
    variables
  });
  Memo2.pushRegionRenames = (mapping) => ({
    kind: "push-region-renames",
    mapping
  });
  Memo2.popRegionRenames = () => ({
    kind: "pop-region-renames"
  });
  Memo2.pushTemplates = (templates) => ({
    kind: "push-templates",
    templates
  });
  Memo2.popTemplates = () => ({
    kind: "pop-templates"
  });
})(Memo || (Memo = {}));

var ALIAS = Symbol.for("yaml.alias");
var DOC = Symbol.for("yaml.document");
var MAP = Symbol.for("yaml.map");
var PAIR = Symbol.for("yaml.pair");
var SCALAR = Symbol.for("yaml.scalar");
var SEQ = Symbol.for("yaml.seq");
var NODE_TYPE = Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

var BREAK = Symbol("break visit");
var SKIP = Symbol("skip children");
var REMOVE = Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
  const ctrl = callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visit_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = visit_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = visit_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
  const ctrl = await callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visitAsync_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = await visitAsync_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key, node, visitor, path) {
  if (typeof visitor === "function")
    return visitor(key, node, path);
  if (isMap(node))
    return visitor.Map?.(key, node, path);
  if (isSeq(node))
    return visitor.Seq?.(key, node, path);
  if (isPair(node))
    return visitor.Pair?.(key, node, path);
  if (isScalar(node))
    return visitor.Scalar?.(key, node, path);
  if (isAlias(node))
    return visitor.Alias?.(key, node, path);
  return void 0;
}
function replaceNode(key, path, node) {
  const parent = path[path.length - 1];
  if (isCollection(parent)) {
    parent.items[key] = node;
  } else if (isPair(parent)) {
    if (key === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt} parent`);
  }
}

var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line.trim().split(/[ \t]+/);
    const name = parts.shift();
    switch (name) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version2] = parts;
        if (version2 === "1.1" || version2 === "1.2") {
          this.yaml.version = version2;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version2);
          onError(6, `Unsupported YAML version ${version2}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error) {
        onError(String(error));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags[node.tag] = true;
      });
      tagNames = Object.keys(tags);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name = `${prefix}${i}`;
    if (!exclude.has(name))
      return name;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error = new Error("Failed to resolve repeated object (this should not happen)");
          error.source = source;
          throw error;
        }
      }
    },
    sourceObjects
  };
}

function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v0)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v0)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === void 0)
          val.delete(v0);
        else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v0)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key, val);
}

function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v, i) => toJS(v, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data);
    ctx.onCreate = (res2) => {
      data.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const { anchors, doc, maxAliasCount } = ctx;
    const source = this.resolve(doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    let data = anchors.get(source);
    if (!data) {
      toJS(source, null, ctx);
      data = anchors.get(source);
    }
    if (data?.res === void 0) {
      const msg = "This should not happen: Alias anchor was not resolved?";
      throw new ReferenceError(msg);
    }
    if (maxAliasCount >= 0) {
      data.count += 1;
      if (data.aliasCount === 0)
        data.aliasCount = getAliasCount(doc, source, anchors);
      if (data.count * data.aliasCount > maxAliasCount) {
        const msg = "Excessive alias count indicates a resource exhaustion attack";
        throw new ReferenceError(msg);
      }
    }
    return data.res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count)
        count = c;
    }
    return count;
  } else if (isPair(node)) {
    const kc = getAliasCount(doc, node.key, anchors);
    const vc = getAliasCount(doc, node.value, anchors);
    return Math.max(kc, vc);
  }
  return 1;
}

var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter((t) => t.tag === tagName);
    const tagObj = match.find((t) => !t.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map2.items.push(value);
    return map2;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

function collectionFromPath(schema4, path, value) {
  let v = value;
  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      v = /* @__PURE__ */ new Map([[k, v]]);
    }
  }
  return createNode(v, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path, value) {
    if (isEmptyPath(path))
      this.add(value);
    else {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.delete(key);
    const node = this.get(key, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    const [key, ...rest] = path;
    const node = this.get(key, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.has(key);
    const node = this.get(key, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    const [key, ...rest] = path;
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
};

var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
  if (/^\n+$/.test(comment))
    return comment.substring(1);
  return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep)
    return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split2 = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text, i, indent.length);
      end = i + indent.length + endStep;
      split2 = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split2 = i;
      }
      if (i >= end) {
        if (split2) {
          folds.push(split2);
          end = split2 + endStep;
          split2 = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split2 = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text;
  if (onFold)
    onFold();
  let res = text.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text.length;
    if (fold === 0)
      res = `
${indent}${text.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text[fold]}\\`;
      res += `
${indent}${text.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text[++i];
    } else {
      do {
        ch = text[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text[start];
    }
  }
  return end;
}

var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code = json.substr(i + 2, 4);
            switch (code) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code.substr(0, 2) === "00")
                  str += "\\x" + code.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs;
  if (singleQuote === false)
    qs = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs = doubleQuotedString;
    else
      qs = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header = (startWithSpace ? indentSize : "") + chomp;
  if (comment) {
    header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags } = ctx.doc.schema;
    if (tags.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t);
    if (res === null)
      throw new Error(`Unsupported default string type ${t}`);
  }
  return res;
}

function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags, item) {
  if (item.tag) {
    const match = tags.filter((t) => t.tag === item.tag);
    if (match.length > 0)
      return match.find((t) => t.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags.filter((t) => t.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t) => t.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
  } else {
    obj = item;
    tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
  }
  if (!tagObj) {
    const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key) && key.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key) || !isNode(key) && typeof key === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws = " ";
  if (keyComment || vsb || vcb) {
    ws = vsb ? "\n" : "";
    if (vcb) {
      const cs = commentString(vcb);
      ws += `
${indentComment(cs, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws === "\n" && valueComment)
        ws = "\n\n";
    } else {
      ws += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws = "";
  }
  str += ws + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map2, value) {
  value = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
  if (isSeq(value))
    for (const it of value.items)
      mergeValue(ctx, map2, it);
  else if (Array.isArray(value))
    for (const it of value)
      mergeValue(ctx, map2, it);
  else
    mergeValue(ctx, map2, value);
}
function mergeValue(ctx, map2, value) {
  const source = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key, value2] of srcMap) {
    if (map2 instanceof Map) {
      if (!map2.has(key))
        map2.set(key, value2);
    } else if (map2 instanceof Set) {
      map2.add(key);
    } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
      Object.defineProperty(map2, key, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map2;
}

function addPairToJSMap(ctx, map2, { key, value }) {
  if (isNode(key) && key.addToJSMap)
    key.addToJSMap(ctx, map2, value);
  else if (isMergeKey(ctx, key))
    addMergeToJSMap(ctx, map2, value);
  else {
    const jsKey = toJS(key, "", ctx);
    if (map2 instanceof Map) {
      map2.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map2 instanceof Set) {
      map2.add(jsKey);
    } else {
      const stringKey = stringifyKey(key, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map2)
        Object.defineProperty(map2, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map2[stringKey] = jsValue;
    }
  }
  return map2;
}
function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

function createPair(key, value, ctx) {
  const k = createNode(key, void 0, ctx);
  const v = createNode(value, void 0, ctx);
  return new Pair(k, v);
}
var Pair = class _Pair {
  constructor(key, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key;
    this.value = value;
  }
  clone(schema4) {
    let { key, value } = this;
    if (isNode(key))
      key = key.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
    if (comment2)
      str2 += lineComment(str2, itemIndent, commentString(comment2));
    if (chompKeep && comment2)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      str += line ? `
${indent}${line}` : "\n";
    }
  }
  if (comment) {
    str += "\n" + indentComment(commentString(comment), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment = ik.comment;
      }
    }
    if (comment)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment = null);
    if (i < items.length - 1)
      str += ",";
    if (comment)
      str += lineComment(str, itemIndent, commentString(comment));
    if (!reqNewline && (lines.length > linesAtValue || str.includes("\n")))
      reqNewline = true;
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line of lines)
        str += line ? `
${indentStep}${indent}${line}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
  if (comment && chompKeep)
    comment = comment.replace(/^\n+/, "");
  if (comment) {
    const ic = indentComment(commentString(comment), indent);
    lines.push(ic.trimStart());
  }
}

function findPair(items, key) {
  const k = isScalar(key) ? key.value : key;
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key || it.key === k)
        return it;
      if (isScalar(it.key) && it.key.value === k)
        return it;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map2 = new this(schema4);
    const add = (key, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key, value);
      else if (Array.isArray(replacer) && !replacer.includes(key))
        return;
      if (value !== void 0 || keepUndefined)
        map2.items.push(createPair(key, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key, value] of obj)
        add(key, value);
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj))
        add(key, obj[key]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map2.items.sort(schema4.sortMapEntries);
    }
    return map2;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key) {
    const it = findPair(this.items, key);
    if (!it)
      return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const it = findPair(this.items, key);
    const node = it?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key) {
    return !!findPair(this.items, key);
  }
  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type2) {
    const map2 = Type2 ? new Type2() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const item of this.items)
      addPairToJSMap(ctx, map2, item);
    return map2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map2, onError) {
    if (!isMap(map2))
      onError("Expected a mapping for this tag");
    return map2;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return void 0;
    const it = this.items[idx];
    return !keepScalar && isScalar(it) ? it.value : it;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it of obj) {
        if (typeof replacer === "function") {
          const key = obj instanceof Set ? it : String(i++);
          it = replacer.call(obj, key, it);
        }
        seq2.items.push(createNode(it, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key) {
  let idx = isScalar(key) ? key.value : key;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

var string = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

function stringifyNumber({ format, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

var schema = [
  map,
  seq,
  string,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
  }
};

function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn = pair.value ?? pair.key;
          cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it of iterable) {
      if (typeof replacer === "function")
        it = replacer.call(iterable, String(i++), it);
      let key, value;
      if (Array.isArray(it)) {
        if (it.length === 2) {
          key = it[0];
          value = it[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);
        if (keys.length === 1) {
          key = keys[0];
          value = it[key];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key = it;
      }
      pairs2.items.push(createPair(key, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map2 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const pair of this.items) {
      let key, value;
      if (isPair(pair)) {
        key = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, "", ctx);
      }
      if (map2.has(key))
        throw new Error("Ordered maps must not include duplicate keys");
      map2.set(key, value);
    }
    return map2;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key } of pairs2.items) {
      if (isScalar(key)) {
        if (seenKeys.includes(key.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key.value}`);
        } else {
          seenKeys.push(key.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key) {
    let pair;
    if (isPair(key))
      pair = key;
    else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
      pair = new Pair(key.key, null);
    else
      pair = new Pair(key, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map2, onError) {
    if (isMap(map2)) {
      if (map2.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map2);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map2;
  }
};

function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

var schema3 = [
  map,
  seq,
  string,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags = schemaTags;
  if (!tags) {
    if (Array.isArray(customTags))
      tags = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags = tags.concat(tag);
  } else if (typeof customTags === "function") {
    tags = customTags(tags.slice());
  }
  if (addMergeTag)
    tags = tags.concat(merge);
  return tags.reduce((tags2, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags2.includes(tagObj))
      tags2.push(tagObj);
    return tags2;
  }, []);
}

var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs = commentString(doc.comment);
      if (cs.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs, ""));
      } else {
        lines.push(`... ${cs}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc = doc.comment;
    if (dc && chompKeep)
      dc = dc.replace(/^\n+/, "");
    if (dc) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc), ""));
    }
  }
  return lines.join("\n") + "\n";
}

var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version: version2 } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version2 = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version: version2 });
    this.setSchema(version2, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key, value, options = {}) {
    const k = this.createNode(key, null, options);
    const v = this.createNode(value, null, options);
    return new Pair(k, v);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    return assertCollection(this.contents) ? this.contents.delete(key) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    if (isEmptyPath(path))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key) {
    return isCollection(this.contents) ? this.contents.has(key) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path) {
    if (isEmptyPath(path))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    if (isEmptyPath(path)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version2, options = {}) {
    if (typeof version2 === "number")
      version2 = String(version2);
    let opt;
    switch (version2) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version2;
        else
          this.directives = new Directives({ version: version2 });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version2);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

var YAMLError = class extends Error {
  constructor(name, pos, code, message) {
    super();
    this.name = name;
    this.code = code;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLParseError", pos, code, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLWarning", pos, code, message);
  }
};
var prettifyError = (src, lc) => (error) => {
  if (error.pos[0] === -1)
    return;
  error.linePos = error.pos.map((pos) => lc.linePos(pos));
  const { line, col } = error.linePos[0];
  error.message += ` at line ${line}, column ${col}`;
  let ci = col - 1;
  let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
  if (ci >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci - 39, lineStr.length - 79);
    lineStr = "\u2026" + lineStr.substring(trimStart);
    ci -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "\u2026";
  if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
    let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "\u2026\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count = 1;
    const end = error.linePos[1];
    if (end?.line === line && end.col > col) {
      count = Math.max(1, Math.min(end.col - col, 80 - ci));
    }
    const pointer = " ".repeat(ci) + "^".repeat(count);
    error.message += `:

${lineStr}
${pointer}
`;
  }
};

function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment)
          comment = cb;
        else
          comment += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment)
            comment += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

function containsNewline(key) {
  if (!key)
    return null;
  switch (key.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key.source.includes("\n"))
        return true;
      if (key.end) {
        for (const st of key.end)
          if (st.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it of key.items) {
        for (const st of it.start)
          if (st.type === "newline")
            return true;
        if (it.sep) {
          for (const st of it.sep)
            if (st.type === "newline")
              return true;
        }
        if (containsNewline(it.key) || containsNewline(it.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

function flowIndentCheck(indent, fc, onError) {
  if (fc?.type === "flow-collection") {
    const end = fc.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key, sep, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key) {
        if (key.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key && key.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map2.comment)
            map2.comment += "\n" + keyProps.comment;
          else
            map2.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key)) {
        onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map2.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key || key.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map2.range = [bm.offset, offset, commentEnd ?? offset];
  return map2;
}

function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs.offset;
  let commentEnd = null;
  for (const { start, value } of bs.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs.offset, offset, commentEnd ?? offset];
  return seq2;
}

function resolveEnd(end, offset, reqSpace, onError) {
  let comment = "";
  if (end) {
    let hasSpace = false;
    let sep = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += sep + cb;
          sep = "";
          break;
        }
        case "newline":
          if (comment)
            sep += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment, offset };
}

var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
  const isMap2 = fc.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc.offset + fc.start.source.length;
  for (let i = 0; i < fc.items.length; ++i) {
    const collItem = fc.items[i];
    const { start, key, sep, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: fc.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key))
        onError(
          key,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st of start) {
          switch (st.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep)
            for (const st of sep) {
              if (st === valueProps.found)
                break;
              if (st.type === "newline") {
                onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map2 = coll;
        if (mapIncludes(ctx, map2.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map2.items.push(pair);
      } else {
        const map2 = new YAMLMap(ctx.schema);
        map2.flow = true;
        map2.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map2.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map2);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce, ...ee] = fc.end;
  let cePos = offset;
  if (ce?.source === expectedEnd)
    cePos = ce.offset + ce.source.length;
  else {
    const name = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce && ce.source.length !== 1)
      ee.unshift(ce);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc.offset, cePos, end.offset];
  } else {
    coll.range = [fc.offset, cePos, cePos];
  }
  return coll;
}

function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl || nl.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
  if (!tag) {
    const kt = ctx.schema.knownTags[tagName];
    if (kt?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
      tag = kt;
    } else {
      if (kt) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

function resolveBlockScalar(ctx, scalar, onError) {
  const start = scalar.offset;
  const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
  if (!header)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar.source ? splitLines(scalar.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content = lines[i][1];
    if (content === "" || content === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header.length;
    if (scalar.source)
      end2 += scalar.source.length;
    return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar.indent + header.indent;
  let offset = scalar.offset + header.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content] = lines[i];
    if (content === "" || content === "\r") {
      if (header.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content] = lines[i];
    offset += indent.length + content.length + 1;
    const crlf = content[content.length - 1] === "\r";
    if (crlf)
      content = content.slice(0, -1);
    if (content && indent.length < trimIndent) {
      const src = header.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
    } else if (indent.length > trimIndent || content[0] === "	") {
      if (sep === " ")
        sep = "\n";
      else if (!prevMoreIndented && sep === "\n")
        sep = "\n\n";
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
      prevMoreIndented = true;
    } else if (content === "") {
      if (sep === "\n")
        value += "\n";
      else
        sep = "\n";
    } else {
      value += sep + content;
      sep = " ";
      prevMoreIndented = false;
    }
  }
  switch (header.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header.length + scalar.source.length;
  return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error === -1)
        error = offset + i;
    }
  }
  if (error !== -1)
    onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts = token.source;
        if (ts && typeof ts === "string")
          length += ts.length;
      }
    }
  }
  return { mode, indent, chomp, comment, length };
}
function splitLines(source) {
  const split2 = source.split(/\n( *)/);
  const first = split2[0];
  const m = first.match(/^( *)/);
  const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split2.length; i += 2)
    lines.push([split2[i], split2[i + 1]]);
  return lines;
}

function resolveFlowScalar(scalar, strict, onError) {
  const { offset, type, source, end } = scalar;
  let _type;
  let value;
  const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    default:
      onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re.comment,
    range: [offset, valueEnd, re.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return foldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return foldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function foldLines(source) {
  let first, line;
  try {
    first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
    line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
  } catch {
    first = /(.*?)[ \t]*\r?\n/sy;
    line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
  }
  let match = first.exec(source);
  if (!match)
    return source;
  let res = match[1];
  let sep = " ";
  let pos = first.lastIndex;
  line.lastIndex = pos;
  while (match = line.exec(source)) {
    if (match[1] === "") {
      if (sep === "\n")
        res += sep;
      else
        sep = "\n";
    } else {
      res += sep + match[1];
      sep = " ";
    }
    pos = line.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc = escapeCodes[next];
      if (cc)
        res += cc;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = { x: 2, u: 4, U: 8 }[next];
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "\x85",
  // Unicode next line
  _: "\xA0",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc = source.substr(offset, length);
  const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
  const code = ok ? parseInt(cc, 16) : NaN;
  if (isNaN(code)) {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
  return String.fromCodePoint(code);
}

function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar = isScalar(res) ? res : new Scalar(res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar = new Scalar(value);
  }
  scalar.range = range;
  scalar.source = value;
  if (type)
    scalar.type = type;
  if (tagName)
    scalar.tag = tagName;
  if (tag.format)
    scalar.format = tag.format;
  if (comment)
    scalar.comment = comment;
  return scalar;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt = schema4.knownTags[tagName];
  if (kt && !kt.collection) {
    schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
    return kt;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts = directives.tagString(tag.tag);
      const cs = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts} or ${cs}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st = before[i];
      switch (st.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st.source.length;
          continue;
      }
      st = before[++i];
      while (st?.type === "space") {
        offset += st.source.length;
        st = before[++i];
      }
      break;
    }
  }
  return offset;
}

var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      node = composeCollection(CN, ctx, token, props, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError);
      isSrcToken = false;
    }
  }
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment;
    else
      node.commentBefore = comment;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    node.comment = comment;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re.offset];
  if (re.comment)
    alias.comment = re.comment;
  return alias;
}

function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re = resolveEnd(end, contentEnd, false, onError);
  if (re.comment)
    doc.comment = re.comment;
  doc.range = [offset, contentEnd, re.offset];
  return doc;
}

function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code, message));
      else
        this.errors.push(new YAMLParseError(pos, code, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment) {
      const dc = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
      } else if (afterEmptyLine || doc.directives.docStart || !dc) {
        doc.commentBefore = comment;
      } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
        let it = dc.items[0];
        if (isPair(it))
          it = it.key;
        const cb = it.commentBefore;
        it.commentBefore = cb ? `${comment}
${cb}` : comment;
      } else {
        const cb = dc.commentBefore;
        dc.commentBefore = cb ? `${comment}
${cb}` : comment;
      }
    }
    if (afterDoc) {
      Array.prototype.push.apply(doc.errors, this.errors);
      Array.prototype.push.apply(doc.warnings, this.warnings);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error);
        else
          this.doc.errors.push(error);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc = this.doc.comment;
          this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

var BREAK2 = Symbol("break visit");
var SKIP2 = Symbol("skip children");
var REMOVE2 = Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path) => {
  let item = cst;
  for (const [field, index] of path) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path) => {
  const parent = visit2.itemAtPath(cst, path.slice(0, -1));
  const field = path[path.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
  let ctrl = visitor(item, path);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK2)
          return BREAK2;
        else if (ci === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}

var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt = this.buffer.substr(offset, 3);
      if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line = this.getLine();
    if (line === null)
      return this.setNext("stream");
    if (line[0] === BOM) {
      yield* this.pushCount(1);
      line = line.substring(1);
    }
    if (line[0] === "%") {
      let dirEnd = line.length;
      let cs = line.indexOf("#");
      while (cs !== -1) {
        const ch = line[cs - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs - 1;
          break;
        } else {
          cs = line.indexOf("#", cs + 1);
        }
      }
      while (true) {
        const ch = line[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return yield* this.parseBlockStart();
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line = this.getLine();
    if (line === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line[n]) {
      case "#":
        yield* this.pushCount(line.length - n);
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl, sp;
    let indent = -1;
    do {
      nl = yield* this.pushNewline();
      if (nl > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl + sp > 0);
    const line = this.getLine();
    if (line === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl = qb.indexOf("\n", this.pos);
    if (nl !== -1) {
      while (nl !== -1) {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = qb.indexOf("\n", cs);
      }
      if (nl !== -1) {
        end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = this.buffer.indexOf("\n", cs);
      } while (nl !== -1);
      if (nl === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl = this.buffer.length;
      }
    }
    let i = nl + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs = this.continueScalar(i + 1);
          if (cs === -1)
            break;
          i = Math.max(i, cs - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    switch (this.charAt(0)) {
      case "!":
        return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
      case "&":
        return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
      case "-":
      case "?":
      case ":": {
        const inFlow = this.flowLevel > 0;
        const ch1 = this.charAt(1);
        if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
          if (!inFlow)
            this.indentNext = this.indentValue + 1;
          else if (this.flowKey)
            this.flowKey = false;
          return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        }
      }
    }
    return 0;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

function includesToken(list, type) {
  for (let i = 0; i < list.length; ++i)
    if (list[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list) {
  for (let i = 0; i < list.length; ++i) {
    switch (list[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it = parent.items[parent.items.length - 1];
      return it.sep ?? it.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function fixFlowSeqItems(fc) {
  if (fc.start.type === "flow-seq-start") {
    for (const it of fc.items) {
      if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
        if (it.key)
          it.value = it.key;
        delete it.key;
        if (isFlowToken(it.value)) {
          if (it.value.end)
            Array.prototype.push.apply(it.value.end, it.sep);
          else
            it.value.end = it.sep;
        } else
          Array.prototype.push.apply(it.start, it.sep);
        delete it.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error) {
    const token = error ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it = top.items[top.items.length - 1];
          if (it.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it.sep) {
            it.value = token;
          } else {
            Object.assign(it, { key: token, sep: [] });
            this.onKeyLine = !it.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it = top.items[top.items.length - 1];
          if (it.value)
            top.items.push({ start: [], value: token });
          else
            it.value = token;
          break;
        }
        case "flow-collection": {
          const it = top.items[top.items.length - 1];
          if (!it || it.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it.sep)
            it.value = token;
          else
            Object.assign(it, { key: token, sep: [] });
          return;
        }
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep;
      if (scalar.end) {
        sep = scalar.end;
        sep.push(this.sourceToken);
        delete scalar.end;
      } else
        sep = [this.sourceToken];
      const map2 = {
        type: "block-map",
        offset: scalar.offset,
        indent: scalar.indent,
        items: [{ start, key: scalar, sep }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map2;
    } else
      yield* this.lineEnd(scalar);
  }
  *blockScalar(scalar) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        yield* this.pop();
        break;
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map2) {
    const it = map2.items[map2.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          it.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it.value) {
          map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it.start, map2.indent)) {
            const prev = map2.items[map2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              Array.prototype.push.apply(end, it.start);
              end.push(this.sourceToken);
              map2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map2.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
      const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it.sep && !it.value) {
        const nl = [];
        for (let i = 0; i < it.sep.length; ++i) {
          const st = it.sep[i];
          switch (st.type) {
            case "newline":
              nl.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st.indent > map2.indent)
                nl.length = 0;
              break;
            default:
              nl.length = 0;
          }
        }
        if (nl.length >= 2)
          start = it.sep.splice(nl[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start });
            this.onKeyLine = true;
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it.sep && !it.explicitKey) {
            it.start.push(this.sourceToken);
            it.explicitKey = true;
          } else if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it.explicitKey) {
            if (!it.sep) {
              if (includesToken(it.start, "newline")) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it.value) {
              map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it.start);
              const key = it.key;
              const sep = it.sep;
              sep.push(this.sourceToken);
              delete it.key;
              delete it.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key, sep }]
              });
            } else if (start.length > 0) {
              it.sep = it.sep.concat(start, this.sourceToken);
            } else {
              it.sep.push(this.sourceToken);
            }
          } else {
            if (!it.sep) {
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            } else if (it.value || atNextItem) {
              map2.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (atNextItem || it.value) {
            map2.items.push({ start, key: fs, sep: [] });
            this.onKeyLine = true;
          } else if (it.sep) {
            this.stack.push(fs);
          } else {
            Object.assign(it, { key: fs, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map2);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map2.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              Array.prototype.push.apply(end, it.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it.value || this.indent <= seq2.indent)
          break;
        it.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it.value || includesToken(it.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc) {
    const it = fc.items[fc.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it || it.sep)
            fc.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it || it.value)
            fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            Object.assign(it, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it || it.value)
            fc.items.push({ start: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            it.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (!it || it.value)
            fc.items.push({ start: [], key: fs, sep: [] });
          else if (it.sep)
            this.stack.push(fs);
          else
            Object.assign(it, { key: fs, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc);
        const sep = fc.end.splice(1, fc.end.length);
        sep.push(this.sourceToken);
        const map2 = {
          type: "block-map",
          offset: fc.offset,
          indent: fc.indent,
          items: [{ start, key: fc, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else {
        yield* this.lineEnd(fc);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl = this.source.indexOf("\n") + 1;
      while (nl !== 0) {
        this.onNewLine(this.offset + nl);
        nl = this.source.indexOf("\n", nl) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st) => st.type === "newline" || st.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}
function parse(src, reviver, options) {
  let _reviver = void 0;
  if (typeof reviver === "function") {
    _reviver = reviver;
  } else if (options === void 0 && reviver && typeof reviver === "object") {
    options = reviver;
  }
  const doc = parseDocument(src, options);
  if (!doc)
    return null;
  doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
  if (doc.errors.length > 0) {
    if (doc.options.logLevel !== "silent")
      throw doc.errors[0];
    else
      doc.errors = [];
  }
  return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify3(value, replacer, options) {
  let _replacer = null;
  if (typeof replacer === "function" || Array.isArray(replacer)) {
    _replacer = replacer;
  } else if (options === void 0 && replacer) {
    options = replacer;
  }
  if (typeof options === "string")
    options = options.length;
  if (typeof options === "number") {
    const indent = Math.round(options);
    options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
  }
  if (value === void 0) {
    const { keepUndefined } = options ?? replacer ?? {};
    if (!keepUndefined)
      return void 0;
  }
  if (isDocument(value) && !_replacer)
    return value.toString(options);
  return new Document(value, _replacer, options).toString(options);
}

var schemaYamls = {
  "schema:ethdebug/format/data/hex": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/data/hex"\n\ntitle: ethdebug/format/data/hex\ndescription: |\n  A `0x`-prefixed hexadecimal string. This value **must** contain at least one\n  hexadecimal character (`0x` by itself is not allowed).\n\ntype: string\npattern: "^0x[0-9a-fA-F]{1,}$"\n\nexamples:\n  - "0x0000"\n  - "0x1"\n',
  "schema:ethdebug/format/data/stamp": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/data/stamp"\n\ntitle: ethdebug/format/data/stamp\ndescription: |\n  Names the schema an object conforms to and the version of the\n  specification that defines that schema.\n\n  `schema` is the name of the schema, for example\n  `ethdebug/format/program`; the `$id` of that schema is `schema:`\n  followed by this name. `version` is the version of the specification\n  that defines it, as a semver string.\n\ntype: object\n\nproperties:\n  schema:\n    type: string\n    title: Schema identifier\n    description: |\n      The name of the schema this object conforms to, for example\n      `ethdebug/format/program`. The schema\'s `$id` is `schema:`\n      followed by this name.\n\n  version:\n    type: string\n    title: Specification version\n    description: |\n      The version of the specification that defines\n      `schema`, as a semver string without build metadata.\n    pattern: "^(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)\\\\.(0|[1-9]\\\\d*)(?:-((?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\\\.(?:0|[1-9]\\\\d*|\\\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$"\n\nrequired:\n  - schema\n  - version\n\nadditionalProperties: false\n\nexamples:\n  - schema: "ethdebug/format/program"\n    version: "0.1.0-draft.1"\n',
  "schema:ethdebug/format/data/unsigned": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/data/unsigned"\n\ntitle: ethdebug/format/data/unsigned\ndescription: |\n  A non-negative integer encoded as a JSON number.\n\ntype: integer\nminimum: 0\n\nexamples:\n  - 0\n  - 100\n',
  "schema:ethdebug/format/data/value": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/data/value"\n\ntitle: ethdebug/format/data/value\ndescription: |\n  A non-negative integer value, expressed either as a native JSON number or as\n  a `0x`-prefixed hexadecimal string.\n\noneOf:\n  - description: A non-negative integer literal\n    $ref: "schema:ethdebug/format/data/unsigned"\n\n  - description: |\n      A `0x`-prefixed hexadecimal string representing literal bytes or a number\n      commonly displayed in base 16 (e.g. bytecode instruction offsets).\n    $ref: "schema:ethdebug/format/data/hex"\n\nexamples:\n  - "0x0000"\n  - 2\n',
  "schema:ethdebug/format/info/resources": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/info/resources"\n\ntitle: ethdebug/format/info/resources\ndescription: |\n  An object containing lookup tables for finding debugging resources by name.\n\ntype: object\n\nproperties:\n  ethdebug:\n    title: Stamp\n    description: |\n      Names this schema and the specification version. A resources\n      object must carry this field. All objects of one compilation\n      must name the same `version`.\n    allOf:\n      - $ref: "schema:ethdebug/format/data/stamp"\n      # note: whitespace chars are \\255 (nbsp)\n      - title: \'{\xA0"schema":\xA0"ethdebug/format/info/resources"\xA0}\'\n        properties:\n          schema:\n            $dynamicRef: "#SchemaName"\n\n  types:\n    title: Types by name\n    description: |\n      A collection of types by name identifier.\n    type: object\n    additionalProperties:\n      $ref: "schema:ethdebug/format/type"\n\n  pointers:\n    title: Pointer templates by name\n    description: |\n      A collection of pointer templates by name identifier.\n    type: object\n    additionalProperties:\n      $ref: "schema:ethdebug/format/pointer/template"\n\n  compilation:\n    $ref: "schema:ethdebug/format/materials/compilation"\n\nrequired:\n  - ethdebug\n  - types\n  - pointers\n\n$defs:\n  SchemaName:\n    $dynamicAnchor: SchemaName\n    description: |\n      The schema name that the `ethdebug` field\'s `schema` must give. A\n      schema that references this one can supply its own name here with\n      a `SchemaName` dynamic anchor.\n    const: "ethdebug/format/info/resources"\n\nexamples:\n  - ethdebug:\n      schema: "ethdebug/format/info/resources"\n      version: "0.1.0-draft.1"\n    types:\n      "struct__Coordinate":\n        kind: struct\n        contains:\n          - name: x\n            type:\n              kind: uint\n              bits: 128\n          - name: y\n            type:\n              kind: uint\n              bits: 128\n        definition:\n          name: Coordinate\n          location:\n            source:\n              id: 5\n            range:\n              offset: 18\n              length: 55\n\n    pointers:\n      "struct__Coordinate__storage":\n        expect:\n          - contract_variable_slot__struct__Coordinate__storage\n        for:\n          group:\n            - name: member__x__struct__Coordinate__storage\n              location: storage\n              slot: contract_variable_slot__struct__Coordinate__storage\n              offset: 0\n              length: 16\n            - name: member__y__struct__Coordinate__storage\n              location: storage\n              slot: contract_variable_slot__struct__Coordinate__storage\n              offset:\n                $sum:\n                  - .offset: member__x__struct__Coordinate__storage\n                  - .length: member__x__struct__Coordinate__storage\n              length: 16\n',
  "schema:ethdebug/format/info": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/info"\n\ntitle: ethdebug/format/info\ndescription: |\n  Debugging information about a single compilation\n\ntype: object\n\n$ref: "schema:ethdebug/format/info/resources"\n\nproperties:\n  ethdebug:\n    title: Stamp\n    description: |\n      Names this schema and the specification version. An info document\n      must carry this field. A program in `programs` should not carry\n      one; the stamp of this document covers it. All objects of one\n      compilation must name the same `version`.\n    allOf:\n      - $ref: "schema:ethdebug/format/data/stamp"\n      # note: whitespace chars are \\255 (nbsp)\n      - title: \'{\xA0"schema":\xA0"ethdebug/format/info"\xA0}\'\n        properties:\n          schema:\n            $dynamicRef: "#SchemaName"\n\n  programs:\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/program"\n\n  compilation:\n    $ref: "schema:ethdebug/format/materials/compilation"\n\nrequired:\n  - ethdebug\n  - compilation\n  - programs\n\nunevaluatedProperties: false\n\n$defs:\n  SchemaName:\n    $dynamicAnchor: SchemaName\n    description: |\n      The schema name that the `ethdebug` field\'s `schema` must give.\n      This fills the slot that **ethdebug/format/info/resources**\n      declares, so that an info document names **ethdebug/format/info**.\n    const: "ethdebug/format/info"\n\nexamples:\n  - ethdebug:\n      schema: "ethdebug/format/info"\n      version: "0.1.0-draft.1"\n    compilation:\n      id: __301f3b6d85831638\n      compiler:\n        name: egc\n        version: 0.2.3+commit.8b37fa7a\n      settings:\n        turbo: true\n      sources:\n        - id: 1\n          path: "Escrow.eg"\n          language: examplelang\n          contents: |\n            import { Asset } from std::asset::fungible;\n\n            type State = !slots[\n              ready: bool,\n              complete: bool,\n\n              beneficiary: address,\n\n              asset: Asset,\n              amount: uint256,\n\n              canRemit: () -> bool,\n            ]\n\n            @create\n            func setup(\n              beneficiary: address,\n              asset: Asset,\n              canRemit: () -> bool,\n            ) -> State:\n              return {\n                ready = False,\n                complete = False,\n                beneficiary,\n                asset,\n                amount = 0,\n                canRemit,\n              }\n\n            @abi\n            @state(self: State)\n            @account(self)\n            func deposit(depositor: address, amount: uint256):\n              require(!self.ready)\n              require(!self.complete)\n\n              # expects an existing allowance (also known as "approval")\n              self.asset.transferFrom(depositor, self, amount)\n\n              self.amount = amount\n              self.ready = True\n\n            @abi\n            @state(self: State)\n            func remit():\n              require(self.ready)\n              require(!self.complete)\n\n              require(self.canRemit())\n\n              asset.transfer(self.beneficiary, self.amount)\n\n              self.complete = True\n\n    types:\n      # Define the State type structure\n      State:\n        kind: "struct"\n        contains:\n          - name: "ready"\n            type:\n              kind: "bool"\n          - name: "complete"\n            type:\n              kind: "bool"\n          - name: "beneficiary"\n            type:\n              kind: "address"\n          - name: "asset"\n            type:\n              kind: "struct"\n              contains:\n                - name: "address"\n                  type:\n                    kind: "address"\n          - name: "amount"\n            type:\n              kind: "uint"\n              bits: 256\n          - name: "canRemit"\n            type:\n              kind: "function"\n              internal: true\n              contains:\n                parameters:\n                  type:\n                    kind: "tuple"\n                    contains: []\n                returns:\n                  type:\n                    kind: "bool"\n\n    pointers:\n      # Define storage layout for the State struct\n      State_storage:\n        expect: ["slot"]\n        for:\n          group:\n            - name: "ready"\n              location: "storage"\n              slot: "slot"\n              offset: 0\n              length: 1\n            - name: "complete"\n              location: "storage"\n              slot: "slot"\n              offset: 1\n              length: 1\n            - name: "beneficiary"\n              location: "storage"\n              slot: { "$sum": ["slot", 1] }\n            - name: "asset"\n              location: "storage"\n              slot: { "$sum": ["slot", 2] }\n            - name: "amount"\n              location: "storage"\n              slot: { "$sum": ["slot", 3] }\n            - name: "canRemit"\n              location: "storage"\n              slot: { "$sum": ["slot", 4] }\n\n    programs:\n      - contract:\n          name: "Escrow"\n          definition:\n            source:\n              id: 1\n            range:\n              offset: 0\n              length: 891\n        environment: "create"\n        instructions:\n          - offset: 0\n            operation:\n              mnemonic: "PUSH1"\n              arguments: ["0x80"]\n            context:\n              code:\n                source:\n                  id: 1\n                range:\n                  offset: 891\n                  length: 20\n',
  "schema:ethdebug/format/materials/compilation": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/materials/compilation"\n\ntitle: ethdebug/format/materials/compilation\ndescription: |\n  An object representing a single invocation of a compiler.\n\ntype: object\nproperties:\n  id:\n    description: |\n      Compilation ID\n\n      This value **should** be globally-unique and generated only from the\n      compiler inputs (settings, sources, etc.); the same compiler inputs/\n      settings **should** produce the same identifier.\n\n    $ref: "schema:ethdebug/format/materials/id"\n\n  compiler:\n    type: object\n    title: Compiler name and version\n    properties:\n      name:\n        type: string\n        description: Compiler name\n\n      version:\n        type: string\n        description: |\n          Compiler version.\n\n          This value **should** be specified using the most detailed version\n          representation available, i.e., including source control hash and\n          compiler build information whenever possible.\n\n    required:\n      - name\n      - version\n\n    unevaluatedProperties: false\n\n    examples:\n      - name: lllc\n        version: 0.4.12-develop.2017.6.27+commit.b83f77e0.Linux.g++\n\n  settings:\n    description: |\n      Compiler settings in a format native to the compiler.\n\n      For compilers whose settings includes full source representations, this\n      field **should** be specified in such a way that avoids large data\n      redundancies (e.g. if compiler settings contain full source\n      representations, then this field would significantly duplicate the\n      information represented by the `sources` field in this object).\n\n      In situations where settings information duplicates information\n      represented elsewhere in **ethdebug/format**, compilers **may** adopt\n      any reasonable strategy, e.g.:\n        - omit duplications partially (leaving the rest of the settings\n          intact)\n        - omit this field entirely\n        - specify this field as a hash of the full settings\n          representation (with the expectation that users of this format will\n          have access to the full representation by some other means)\n\n    allOf:\n      - true\n\n  sources:\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/materials/source"\n\nrequired:\n  - id\n  - compiler\n  - sources\n\nunevaluatedProperties: false\n\nexamples:\n  - id: foo\n    compiler:\n      name: lllc\n      version: 0.4.12-develop.2017.6.27+commit.b83f77e0.Linux.g++\n    sources:\n      - id: 0\n        path: stdin\n        contents: |\n          (add 1 (mul 2 (add 3 4)))\n        language: LLL\n',
  "schema:ethdebug/format/materials/encoding": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/materials/encoding"\n\ntitle: ethdebug/format/materials/encoding\ndescription: |\n  A character encoding, identified by a label from the WHATWG Encoding\n  Standard (https://encoding.spec.whatwg.org/).\n\n  The value **must** be a label that the Standard defines \u2014 for example\n  `utf-8`, `utf-16le`, or `windows-1252`. Where the Standard lists several\n  labels for the same encoding, its canonical (lowercase) name is\n  preferred (`utf-16le` rather than `utf-16`, which the Standard treats as\n  a label for the same encoding). Because these are exactly the labels the\n  `TextDecoder` API accepts, a JavaScript consumer can pass the value\n  straight to `new TextDecoder(label)`.\n\n  Where a field of this type is optional and omitted, the encoding is\n  `utf-8`.\n\ntype: string\n\nexamples:\n  - utf-8\n  - utf-16le\n  - windows-1252\n',
  "schema:ethdebug/format/materials/id": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/materials/id"\n\ntitle: ethdebug/format/materials/id\ndescription: |\n  An opaque identifier for a compilation resource (such as a source\n  file or a compilation itself), typically generated by the compiler.\n  Values may be numeric or string and **must** be unique within the\n  scope where they appear (e.g., source IDs within a single\n  compilation).\n\ntype:\n  - number\n  - string\n\nexamples:\n  # example: numeric source index\n  - 0\n  # example: content-addressed compilation ID\n  - "__301f3b6d85831638"\n',
  "schema:ethdebug/format/materials/reference": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/materials/reference"\n\ntitle: ethdebug/format/materials/reference\ndescription: A reference to an external resource by ID\n\ntype: object\nproperties:\n  id:\n    $ref: "schema:ethdebug/format/materials/id"\n\n  type:\n    enum:\n      - compilation\n      - source\n\nrequired: [id]\n\nunevaluatedProperties: false\n\nexamples:\n  - id: 1\n',
  "schema:ethdebug/format/materials/source-range": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/materials/source-range"

title: ethdebug/format/materials/source-range
description: |
  A range of bytes in a particular source.

  Note that this refers to the bytes range in the original character encoding
  for the source, not the character encoding used for strings in this JSON
  format (UTF-8). For compilers that support input sources in encodings other
  than this format's transmission encoding, compilers **must** address source
  ranges in this original encoding, and debuggers **must** re-encode source
  contents obtained from this format _before_ performing any range addressing.

  (Compilers that only accept UTF-8 or ASCII are naturally exempt from this
  concern.)

type: object
properties:
  compilation:
    title: Compilation reference by ID
    $ref: "schema:ethdebug/format/materials/reference"

  source:
    title: Source reference by ID
    $ref: "schema:ethdebug/format/materials/reference"

  range:
    title: Bytes range within source contents
    description: |
      Ranges that span the entire source contents **may** omit this field
      as a shorthand. This field is otherwise **required**.
    type: object
    properties:
      offset:
        description: |
          Byte offset at beginning of range.
        $ref: "schema:ethdebug/format/data/value"

      length:
        description: Number of bytes contained in range
        $ref: "schema:ethdebug/format/data/value"

    unevaluatedProperties: false

    required:
      - offset
      - length

unevaluatedProperties: false

required:
  - source

examples:
  - source:
      id: 5
    range:
      offset: 20
      length: 100
`,
  "schema:ethdebug/format/materials/source": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/materials/source"\n\ntitle: ethdebug/format/materials/source\ndescription: |\n  An object representing one unit of compiler input, the raw text contents and\n  identifying metadata (such as file path) that were given to the compiler as\n  part of a compilation.\n\ntype: object\nproperties:\n  id:\n    description: |\n      Source identifier. This field **must** be unique for all sources\n      within a single compiler invocation (compilation).\n    $ref: "schema:ethdebug/format/materials/id"\n\n  path:\n    type: string\n    description: |\n      Hierarchical file-system-like path to this source. This value may\n      be an absolute path, a path relative to some root directory, a path\n      to some resource within a package, etc.\n\n      This value does not need to correspond to any file on disk (either\n      physical or virtual), and might instead refer to a path identifier\n      for a source that was generated by a compiler or other development tool.\n\n      This format makes no specific restrictions on how paths should be\n      specified (e.g., no restriction on path separators, etc.), other than\n      that values for this field should match what users observe elsewhere for\n      the inputs/outputs of this particular compiler invocation.\n\n      If no path information is available for a particular source, e.g. if the\n      source was provided to the compiler via shell standard input, this field\n      should indicate that somehow (e.g., specifying `"path": "stdin"` or\n      similar).\n\n      This field\'s value **should** be unique across all sources within the\n      same compilation.\n\n  contents:\n    description: |\n      The full contents of the source, possibly re-encoded as UTF-8 to\n      match parent JSON encoding.\n\n      In cases where input source used a different encoding, this object\n      **must** also specify an `encoding` property to indicate the\n      encoding originally used. Where relevant, debuggers **must** also\n      convert these `contents` back to the specified original encoding so\n      as to match code author expectations.\n\n    type: string\n\n  encoding:\n    description: |\n      Character encoding of the original source `contents`. This property\n      is **required** if that encoding does not match the JSON transmission\n      encoding (UTF-8), since the value of the `contents` property will\n      represent the text of the source in this JSON encoding.\n\n      This property **must not** appear in objects that do not specify\n      a `contents` property.\n\n    $ref: "schema:ethdebug/format/materials/encoding"\n\n  language:\n    description: |\n      The high-level language that the source contents are written in.\n\n    type: string\n\nrequired:\n  - id\n  - path\n  - contents\n  - language\n\nunevaluatedProperties: false\n\nexamples:\n  - id: 5\n    path: ./contracts/SimpleStorage.sol\n    contents: |\n      // SPDX-License-Identifier: GPL-3.0\n      pragma solidity >=0.4.16 <0.9.0;\n\n      contract SimpleStorage {\n          uint storedData;\n\n          function set(uint x) public {\n              storedData = x;\n          }\n\n          function get() public view returns (uint) {\n              return storedData;\n          }\n      }\n\n    language: Solidity\n',
  "schema:ethdebug/format/pointer/collection/conditional": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/conditional"\n\ntitle: ethdebug/format/pointer/collection/conditional\ndescription: |\n  A pointer defined conditionally based on the non-zero-ness of some expression\n\ntype: object\n\nproperties:\n  if:\n    $ref: "schema:ethdebug/format/pointer/expression"\n  then:\n    $ref: "schema:ethdebug/format/pointer"\n  else:\n    $ref: "schema:ethdebug/format/pointer"\n\nrequired:\n  - if\n  - then\n\nadditionalProperties: false\n\nexamples:\n  - if: 0\n    then:\n      location: memory\n      offset: 0\n      length: 1\n    else:\n      location: memory\n      offset: 1\n      length: 1\n',
  "schema:ethdebug/format/pointer/collection/group": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/group"\n\ntitle: ethdebug/format/pointer/collection/group\ndescription: |\n  A composite collection of pointers\ntype: object\nproperties:\n  group:\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/pointer"\n    minItems: 1\nrequired:\n  - group\nadditionalProperties: false\n\nexamples:\n  - group:\n      - name: "data-pointer"\n        location: stack\n        slot: 0\n      - location: memory\n        offset:\n          $read: "data-pointer"\n        length: 32\n',
  "schema:ethdebug/format/pointer/collection/list": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/list"\n\ntitle: ethdebug/format/pointer/collection/list\ndescription: |\n  An ordered list of pointers, indexed starting at zero.\ntype: object\nproperties:\n  list:\n    type: object\n    properties:\n      count:\n        description: |\n          The size of the list that this collection represents.\n        $ref: "schema:ethdebug/format/pointer/expression"\n      each:\n        description: |\n          An identifier name whose value as an expression resolves to the index\n          in the list\n        $ref: "schema:ethdebug/format/pointer/identifier"\n      is:\n        description: |\n          The dynamically-generated pointer repeated as a list\n        $ref: "schema:ethdebug/format/pointer"\n    required:\n      - count\n      - each\n      - is\n    additionalProperties: false\n\nrequired:\n  - list\n\nadditionalProperties: false\n\nexamples:\n  - list:\n      count: 5\n      each: "index"\n      is:\n        location: memory\n        offset: "index"\n        length: 1\n',
  "schema:ethdebug/format/pointer/collection/reference": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/reference"\n\ntitle: ethdebug/format/pointer/collection/reference\ndescription: |\n  A pointer by named reference to a pointer template (defined elsewhere).\n\ntype: object\n\nproperties:\n  template:\n    title: Template identifier\n    $ref: "schema:ethdebug/format/pointer/identifier"\n\n  yields:\n    title: Region name mapping\n    description: |\n      Maps region names produced by the template to new names for use\n      outside the template. Unmapped region names pass through unchanged.\n      When omitted, all regions keep their original names.\n    type: object\n    propertyNames:\n      $ref: "schema:ethdebug/format/pointer/identifier"\n    additionalProperties:\n      $ref: "schema:ethdebug/format/pointer/identifier"\n\nrequired:\n  - template\n\nadditionalProperties: false\n\nexamples:\n  - template: "string-storage-pointer"\n\n  - template: "string-storage-pointer"\n    yields:\n      data: "name-data"\n      length: "name-length"\n',
  "schema:ethdebug/format/pointer/collection/scope": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/scope"\n\ntitle: ethdebug/format/pointer/collection/scope\ndescription: |\n  A pointer defined with the aid of additional variables with values specified\n  as expressions.\n\n  Variables are specified by the `define` field as an object mapping of\n  expression by identifier. Variables are specified **in order**, so that\n  later appearing variables may reference earlier ones in the same object.\n\n  The variables are visible only within `in`. Pointers outside this scope\n  do not see them: later members of an enclosing group, for example, see\n  only the variables of their own enclosing scopes. A variable defined here\n  with the same identifier as an outer variable shadows it within `in`.\n\ntype: object\n\nproperties:\n  define:\n    title: Mapping of variables to expression value\n    type: object\n    propertyNames:\n      $ref: "schema:ethdebug/format/pointer/identifier"\n    additionalProperties:\n      $ref: "schema:ethdebug/format/pointer/expression"\n  in:\n    $ref: "schema:ethdebug/format/pointer"\n\nrequired:\n  - define\n  - in\n\nadditionalProperties: false\n\nexamples:\n  - define:\n      example-offset:\n        $sum: [1, 2]\n      example-length:\n        $product: [2, $wordsize]\n    in:\n      name: example\n      location: memory\n      offset: example-offset\n      length: example-length\n',
  "schema:ethdebug/format/pointer/collection/templates": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection/templates"\n\ntitle: ethdebug/format/pointer/collection/templates\ndescription: |\n  A pointer with locally-defined templates available for use within.\n\n  Templates defined here are available by name for reference collections\n  inside the `in` pointer.\n\ntype: object\n\nproperties:\n  templates:\n    title: Mapping of template names to template definitions\n    type: object\n    propertyNames:\n      $ref: "schema:ethdebug/format/pointer/identifier"\n    additionalProperties:\n      $ref: "schema:ethdebug/format/pointer/template"\n  in:\n    $ref: "schema:ethdebug/format/pointer"\n\nrequired:\n  - templates\n  - in\n\nadditionalProperties: false\n\nexamples:\n  - templates:\n      simple-slot:\n        expect: ["slot"]\n        for:\n          location: storage\n          slot: "slot"\n    in:\n      define:\n        slot: 0\n      in:\n        template: "simple-slot"\n',
  "schema:ethdebug/format/pointer/collection": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/collection"\n\ntitle: ethdebug/format/pointer/collection\ndescription: |\n  A representation of a collection of pointers to data in the EVM\ntype: object\nallOf:\n  - oneOf:\n      - required: [group]\n      - required: [list]\n      - required: [if]\n      - required: [define]\n      - required: [template]\n      - required: [templates]\n\n  - if:\n      required: [group]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/group"\n\n  - if:\n      required: [list]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/list"\n\n  - if:\n      required: [if]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/conditional"\n\n  - if:\n      required: [define]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/scope"\n\n  - if:\n      required: [template]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/reference"\n\n  - if:\n      required: [templates]\n    then:\n      $ref: "schema:ethdebug/format/pointer/collection/templates"\n',
  "schema:ethdebug/format/pointer/expression": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/expression"\n\ntitle: ethdebug/format/pointer/expression\ndescription: |\n  A schema for describing expressions that evaluate to values.\n\n  ## Two sorts of value: integers and bytes\n\n  Every expression evaluates to a value of one of two sorts:\n\n  - an **integer** \u2014 an unbounded, non-negative integer. It has a numeric\n    value but **no width**. Arithmetic is ordinary integer arithmetic.\n  - **bytes** \u2014 a finite sequence of bytes with a definite **width** (its\n    byte length).\n\n  The two sorts are produced by different forms:\n\n  - **Integers** are produced by a JSON-number literal, the `$wordsize`\n    constant, a variable or lookup (`.offset` / `.length` / `.slot`) that\n    denotes an index or count, an arithmetic operation (`$sum`,\n    `$difference`, `$product`, `$quotient`, `$remainder`), and a\n    hexadecimal literal that has an **odd** number of digits (which has no\n    whole-byte width \u2014 see `Literal`).\n  - **Bytes** are produced by a hexadecimal literal with an **even** number\n    of digits (its width is the number of bytes written), `$read` (its\n    width is the length of the region read), the resize forms\n    `$sizedN` / `$wordsized` (whose width is `N` / the word size),\n    `$keccak256` (width 32), and `$concat` (width the sum of its operands\').\n\n  ## Coercion and the width-bearing requirement\n\n  Where an **integer** is expected \u2014 arithmetic operands, a list `count`, a\n  segment `slot` / `offset` / `length` \u2014 a bytes value is accepted and read\n  as the non-negative integer its bytes encode (big-endian).\n\n  Where **bytes** are expected \u2014 the operands of `$concat` and `$keccak256`,\n  whose results depend on operand widths \u2014 the operand **must** be\n  width-bearing. A bare integer (a JSON number, an odd-digit hex literal,\n  `$wordsize`, an arithmetic result, or a lookup) is **not** valid there:\n  give it a width first with `$sizedN` or `$wordsized`. There is no\n  implicit widening; the resize forms are the only bridge from an integer\n  to bytes.\n\noneOf:\n  - $ref: "#/$defs/Literal"\n  - $ref: "#/$defs/Variable"\n  - $ref: "#/$defs/Constant"\n  - $ref: "#/$defs/Arithmetic"\n  - $ref: "#/$defs/Lookup"\n  - $ref: "#/$defs/Read"\n  - $ref: "#/$defs/Keccak256"\n  - $ref: "#/$defs/Concat"\n  - $ref: "#/$defs/Resize"\n\n$defs:\n  Literal:\n    title: Literal value\n    description: |\n      A literal value, written either as a JSON number or as a `0x`-prefixed\n      hexadecimal string.\n\n      Its sort follows its form:\n\n      - a JSON number is an **integer** (no width);\n      - a hexadecimal string with an **even** number of digits is **bytes**,\n        whose width is the number of bytes written (`"0x00"` is one zero\n        byte, `"0xdead"` is two bytes);\n      - a hexadecimal string with an **odd** number of digits has no\n        whole-byte width and is therefore an **integer**, equal to the value\n        its digits denote (`"0x1"` is the integer `1`, not bytes).\n\n    $ref: "schema:ethdebug/format/data/value"\n\n    examples:\n      - 5\n      - "0x0000000000000000000000000000000000000000000000000000000000000000"\n\n  Constant:\n    title: Constant value\n    type: string\n    enum:\n      - $wordsize\n\n  Variable:\n    title: Variable identifier\n    description: |\n      A string that matches an identifier used in an earlier declaration of\n      a scalar variable. This expression evaluates to the value of that\n      variable.\n    $ref: "schema:ethdebug/format/pointer/identifier"\n\n  Arithmetic:\n    title: Arithmetic operation\n    description: |\n      Ordinary integer arithmetic. Each operand is taken as an **integer**\n      (a bytes operand is read as the non-negative integer its bytes encode),\n      and the result is an **integer** with no width. To use an arithmetic\n      result where bytes are required, give it a width with `$sizedN` or\n      `$wordsized`.\n    type: object\n    properties:\n      "$sum":\n        description: |\n          A list of expressions to be added together.\n        $ref: "#/$defs/Operands"\n      "$difference":\n        description: |\n          A tuple of two expressions where the second is to be subtracted from\n          the first.\n\n          If the second operand is larger than the first, the result of this\n          arithmetic operation is defined to equal zero (`0`).\n\n          (i.e., `{ "$difference": [a, b] }` equals `a` minus `b`.)\n        $ref: "#/$defs/Operands"\n        minItems: 2\n        maxItems: 2\n      "$product":\n        description: |\n          A list of expressions to be multiplied.\n        $ref: "#/$defs/Operands"\n      "$quotient":\n        description: |\n          A tuple of two expressions where the first corresponds to the\n          dividend and the second corresponds to the divisor, for the purposes\n          of doing integer division.\n\n          (i.e., `{ "$quotient": [a, b] }` equals `a` divided by `b`.)\n        $ref: "#/$defs/Operands"\n        minItems: 2\n        maxItems: 2\n      "$remainder":\n        description: |\n          A tuple of two expressions where the first corresponds to the\n          dividend and the second corresponds to the divisor, for the purposes\n          of computing the modular-arithmetic remainder.\n\n          (i.e., `{ "$remainder": [a, b] }` equals `a` mod `b`.)\n        $ref: "#/$defs/Operands"\n        minItems: 2\n        maxItems: 2\n    additionalProperties: false\n    minProperties: 1\n    maxProperties: 1\n    examples:\n      - "$sum": [5, 3, 4]\n      - "$difference": [5, 3]\n      - "$product": [5, 3, 0]\n      - "$quotient": [5, 3]\n      - "$remainder":\n          - "$product":\n              - 2\n              - 2\n              - 2\n              - 2\n          - 3\n\n  Operands:\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/pointer/expression"\n\n  Lookup:\n    title: Lookup region definition\n    description: |\n      An object of the form `{ ".<property-name>": "<region>" }`, to\n      denote that this expression is equivalent to the defined value for\n      the property named `<property-name>` inside the region referenced as\n      `<region>`. The value is an **integer** (a region\'s `.offset`,\n      `.length`, or `.slot`).\n\n      `<property-name>` **must** be a valid and present property on the\n      corresponding region, or it **must** correspond to an optional property\n      whose schema specifies a default value for that property.\n    type: object\n    patternProperties:\n      "^\\\\.(offset|length|slot)$":\n        $ref: "#/$defs/Reference"\n    additionalProperties: false\n    minProperties: 1\n    maxProperties: 1\n\n    examples:\n      - .offset: "array-count"\n      - .length: "array-item"\n      - .offset: $this\n\n  Read:\n    title: Read region bytes\n    description: |\n      An object of the form `{ "$read": "<region>" }`. The value of this\n      expression equals the raw bytes present in the running machine state\n      in the referenced region. The result is **bytes** whose width is the\n      length of the region read.\n    type: object\n    properties:\n      $read:\n        $ref: "#/$defs/Reference"\n    required:\n      - $read\n    additionalProperties: false\n    examples:\n      - $read: "struct-start"\n\n  Reference:\n    title: Region reference\n    description: |\n      A string value that **must** either be the `"name"` of at least one\n      region declared with `{ "name": "<region>" }` previously in some root\n      pointer representation, or it **must** be the literal value `"$this"`,\n      which indicates a reference to the region containing this expression.\n\n      If more than one region is defined with the same name, resolution is\n      defined as firstly resolving to the latest earlier sibling that declares\n      the matching name, then secondly resolving to the parent if it matches,\n      then to parent\'s earlier siblings, and so on.\n    type: string\n    oneOf:\n      - $ref: "schema:ethdebug/format/pointer/identifier"\n      - const: "$this"\n        description: |\n          Indicates a reference to the region containing this expression.\n          A property lookup via `$this` (e.g. `{ ".length": "$this" }`) must\n          not be circular: the referenced property must be resolvable without\n          depending on the value currently being defined.\n\n  Keccak256:\n    title: Keccak256 hash\n    description: |\n      An object of the form `{ "$keccak256": [...values] }`, indicating\n      that this expression evaluates to the Solidity-style keccak256 hash\n      of the tightly-packed bytes encoded by `values`. The result is\n      **bytes** of width 32.\n\n      Because the hash is taken over the concatenation of the operands\'\n      bytes, each operand **must** be width-bearing (bytes): a bare integer\n      is not valid here and must be given a width first with `$sizedN` or\n      `$wordsized`. This is why a mapping-slot computation word-sizes its key\n      and slot before hashing.\n    type: object\n    properties:\n      $keccak256:\n        title: Array of hashed values\n        type: array\n        items:\n          $ref: "schema:ethdebug/format/pointer/expression"\n    additionalProperties: false\n    required:\n      - $keccak256\n    examples:\n      - $keccak256:\n          - $wordsized: 0\n          - "0x00"\n\n  Concat:\n    title: Concatenate values\n    description: |\n      An object of the form `{ "$concat": [...values] }`, indicating that this\n      expression evaluates to the concatenation of bytes from each value.\n      The byte width of each operand is preserved; no padding is added or\n      removed between operands. The result is **bytes** whose width is the\n      sum of the operand widths.\n\n      Each operand **must** be width-bearing (bytes): a bare integer is not\n      valid here and must be given a width first with `$sizedN` or\n      `$wordsized`.\n    type: object\n    properties:\n      $concat:\n        title: Array of values to concatenate\n        type: array\n        items:\n          $ref: "schema:ethdebug/format/pointer/expression"\n    additionalProperties: false\n    required:\n      - $concat\n    examples:\n      - $concat:\n          - "0x00"\n          - "0x00"\n      - $concat:\n          - "0xdead"\n          - "0xbeef"\n      - $concat: []\n\n  Resize:\n    title: Resize data\n    description: |\n      A resize operation produces **bytes** of a definite width, and is the\n      bridge from an integer to bytes: give it an integer (or bytes) and it\n      yields bytes of the requested width.\n\n      A resize operation expression is either an object of the form\n      `{ "$sized<N>": <expression> }` or an object of the form\n      `{ "$wordsized": <expression> }`, where `<expression>` is an expression\n      whose value is to be resized, and, if applicable, where `<N>` is the\n      smallest decimal representation of an unsigned integer.\n\n      This object\'s value is evaluated as follows, based on the bytes width of\n      the value `<expression>` evaluates to and based on `<N>` (using the\n      value of `"$wordsize"` for `<N>` in the case of the latter form above):\n      - If the width equals `<N>`, this object evaluates to the same value as\n        `<expression>` (equivalent to the identity function or no-op).\n      - If the width is less than `<N>`, this object evaluates to the same value\n        as `<expression>` but with additional zero-bytes (`0x00`) prepended on\n        the left (most significant) side, such that the resulting bytes width\n        equals `<N>`.\n      - If the width exceeds `<N>`, this object evaluates to the same value\n        as `<expression>` but with a number of bytes removed from the left\n        (most significant) side until the bytes width equals `<N>`.\n\n      (These cases match the behavior that Solidity uses for resizing its\n      `bytesN`/`uintN` types.)\n    type: object\n    oneOf:\n      - title: Resize to literal number of bytes\n        type: object\n        patternProperties:\n          "^\\\\$sized([1-9]+[0-9]*)$":\n            $ref: "schema:ethdebug/format/pointer/expression"\n        additionalProperties: false\n      - title: Resize to word-size\n        type: object\n        patternProperties:\n          "^\\\\$wordsized$":\n            $ref: "schema:ethdebug/format/pointer/expression"\n        additionalProperties: false\n    minProperties: 1\n    maxProperties: 1\n    examples:\n      - $sized2: "0x00" # 0x0000\n      - $sized2: "0xffffff" # 0xffff\n      - $wordsized: "0x00" # 0x0000000000000000000000000000000000000000000000000000000000000000\n\nexamples:\n  - 0\n  - $sum:\n      - .offset: "array-start"\n      - .length: "array-start"\n      - 1\n  - $keccak256:\n      - $wordsized: 5\n      - $wordsized:\n          .offset: "array-start"\n',
  "schema:ethdebug/format/pointer/identifier": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/identifier"\n\ntitle: ethdebug/format/pointer/identifier\ndescription: |\n  An identifier for use within the context of a root pointer\ntype: string\npattern: "^[a-zA-Z_\\\\-]+[a-zA-Z0-9$_\\\\-]*$"\n\nexamples:\n  - a\n  - a0\n  - -$\n  - __init__\n',
  "schema:ethdebug/format/pointer/region/base": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/region/base"\n\ntitle: ethdebug/format/pointer/region/base\ndescription: |\n  Common schema for all region schemas, regardless of `"location": ...`.\n\ntype: object\nproperties:\n  name:\n    $ref: "schema:ethdebug/format/pointer/identifier"\n\n  location:\n    type: string\n\nrequired:\n  - location\n\nexamples:\n  - name: "array-item"\n    location: memory\n',
  "schema:ethdebug/format/pointer/region/calldata": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/calldata"

title: ethdebug/format/pointer/region/calldata
description: |
  A schema for representing a region of data in message calldata.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"calldata"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: calldata

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: calldata
    offset: "0x04"
    length: 32
`,
  "schema:ethdebug/format/pointer/region/code": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/code"

title: ethdebug/format/pointer/region/code
description: |
  A schema for representing a region of data in EVM bytecode.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"code"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: code

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: code
    offset: "0x04"
    length: 32
`,
  "schema:ethdebug/format/pointer/region/memory": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/memory"

title: ethdebug/format/pointer/region/memory
description: |
  A schema for representing a region of data in EVM memory. Pointer regions
  within memory represent a single/atomic sequence of byte locations.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"memory"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: memory

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: memory
    offset: "0x04"
    length: 32
`,
  "schema:ethdebug/format/pointer/region/returndata": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/returndata"

title: ethdebug/format/pointer/region/returndata
description: |
  A schema for representing a region of data in message returndata.

  This schema is constructed by extending the base region schema
  and the schema for the slice addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"returndata"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: returndata

    required:
      - location
  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/slice"

unevaluatedProperties: false

examples:
  - location: returndata
    offset: "0x04"
    length: 32
`,
  "schema:ethdebug/format/pointer/region/stack": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/stack"

title: ethdebug/format/pointer/region/stack
description: |
  A schema for representing a region of data in the EVM.

  Describes stack slots as number of positions from the top (at time of
  observation). Debuggers reading this information **should** immediately
  convert these positions to absolute positions from the bottom.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"stack"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: stack

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: stack
    slot: 0
  - location: stack
    slot: 1
    length:
      $product:
        - $wordsize
        - 2
`,
  "schema:ethdebug/format/pointer/region/storage": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/storage"

title: ethdebug/format/pointer/region/storage
description: |
  A schema for representing a region of data in EVM storage.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"storage"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: storage

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: storage
    slot: "0x03"
  - location: storage
    slot: "0x06"
    length:
      $product:
        - $wordsize
        - 2
  - location: storage
    slot: "0x08"
    offset:
      $quotient:
        - $wordsize
        - 2
    length:
      $quotient:
        - $wordsize
        - 2
`,
  "schema:ethdebug/format/pointer/region/transient": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/pointer/region/transient"

title: ethdebug/format/pointer/region/transient
description: |
  A schema for representing a region of data in EVM transient storage.

  This schema is constructed by extending the base region schema
  and the schema for the segment addressing scheme.
type: object
allOf:
  - title: '{\xA0"location":\xA0"transient"\xA0}' # note: whitespace chars are \\255 (nbsp)
    properties:
      location:
        const: transient

    required:
      - location

  - $ref: "schema:ethdebug/format/pointer/region/base"
  - $ref: "schema:ethdebug/format/pointer/scheme/segment"

unevaluatedProperties: false

examples:
  - location: transient
    slot: "0x03"
  - location: transient
    slot: "0x06"
    length:
      $product:
        - $wordsize
        - 2
  - location: transient
    slot: "0x08"
    offset:
      $quotient:
        - $wordsize
        - 2
    length:
      $quotient:
        - $wordsize
        - 2
`,
  "schema:ethdebug/format/pointer/region": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/region"\n\ntitle: ethdebug/format/pointer/region\ndescription: |\n  A representation of a region of data in the EVM\ntype: object\nproperties:\n  location:\n    $ref: "#/$defs/Location"\n\nrequired:\n  - location\n\nallOf:\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: stack\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/stack"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: memory\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/memory"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: storage\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/storage"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: calldata\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/calldata"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: returndata\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/returndata"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: transient\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/transient"\n\n  - if:\n      required:\n        - location\n      properties:\n        location:\n          const: code\n    then:\n      $ref: "schema:ethdebug/format/pointer/region/code"\n\n$defs:\n  Location:\n    type: string\n    enum:\n      - stack\n      - memory\n      - storage\n      - calldata\n      - returndata\n      - transient\n      - code\n\nunevaluatedProperties: false\n\nexamples:\n  - location: storage\n    slot: "0x0000000000000000000000000000000000000000000000000000000000000000"\n',
  "schema:ethdebug/format/pointer/scheme/segment": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/scheme/segment"\n\ntitle: ethdebug/format/pointer/scheme/segment\ndescription: |\n  An addressing scheme for pointing to a range of bytes in a data location\n  arranged as individually-addressable word-sized slots.\n\n  **Note** that this addressing scheme permits addressing byte ranges that\n  extend beyond the last byte of a particular slot, or even covering the range\n  of multiple slots.\n\n  In such cases, this schema defines the range as the concatenation of bytes\n  across slots such that the address of the first byte after the end of slot\n  `p` (i.e., `{ "offset": "$wordsize" }`) is interpreted as the first byte of\n  slot `p + 1`.\n\ntype: object\n\nproperties:\n  slot:\n    $ref: "schema:ethdebug/format/pointer/expression"\n  offset:\n    description: |\n      The starting byte index within the slot.\n\n      Bytes within a slot are numbered from the most significant byte. A\n      slot\'s value is its `$wordsize`-byte big-endian word, and byte `0` is\n      the first byte of that word, as if the word were written to memory. An\n      `offset` of `0` therefore addresses the most significant byte of the\n      slot, and an `offset` of `$wordsize - 1` addresses the least\n      significant byte.\n\n      This field is **optional**. If unspecified, it has the default value of\n      `0`, indicating that the segment begins at the start of the specified\n      slot (its most significant byte).\n\n      A data layout that counts bytes from the low-order end of a slot must\n      convert: a value of `n` bytes that sits `o` bytes from the low-order end\n      is at `offset` `$wordsize - o - n`. An emitter may write that number as\n      a literal, which is the simplest form to read and resolve. It may also\n      write the conversion as an expression, such as\n\n      ```json\n      {\n        "$difference": ["$wordsize", { "$sum": [o, { ".length": "$this" }] }]\n      }\n      ```\n\n      which can take `n` from the region\'s own `length`, keeps the layout\'s\n      own numbers visible, needs no arithmetic in the emitter, and does not\n      depend on a fixed word size.\n\n      This field\'s expression must resolve to a non-negative value. It is\n      **not** bounded by the word size: an offset that meets or exceeds\n      `$wordsize` carries into subsequent slots. Given a `slot` value `p`\n      and an `offset` value `n`, the segment begins at byte\n      `n mod $wordsize` of slot `p + floor(n / $wordsize)`. (Equivalently,\n      byte `{ "offset": "$wordsize" }` of slot `p` is byte `0` of slot\n      `p + 1`, consistent with the multi-slot note above.) Emitters may\n      therefore chain byte sums across a slot boundary without decomposing\n      into slot and byte components themselves; a resolver recovers the\n      effective slot and byte by division and remainder against\n      `$wordsize`.\n    $ref: "schema:ethdebug/format/pointer/expression"\n    default: 0\n  length:\n    description: |\n      The length of the bytes range this segment represents.\n\n      This field is **optional**. If unspecified, its default value indicates\n      that the segment ends at the end of the slot in which it begins (after\n      applying any `offset` carry).\n\n      If this field has value larger than the default value, i.e., if the\n      segment extends beyond the last byte in the slot, then this segment is\n      defined to be the concatenation of the sequentially-addressed slot(s)\n      following the slot specified.\n    $ref: "schema:ethdebug/format/pointer/expression"\n    default:\n      $difference:\n        - $wordsize\n        - $remainder:\n            - .offset: $this\n            - $wordsize\n\nrequired:\n  - slot\n\nexamples:\n  - slot: 0\n  - slot: 1\n    length:\n      $product:\n        - $wordsize\n        - 3\n  # a carry example: an offset at or beyond `$wordsize` addresses a later\n  # slot. Here `offset: $wordsize` is byte 0 of slot 1, so this segment is\n  # the 4 bytes beginning there.\n  - slot: 0\n    offset: $wordsize\n    length: 4\n  # packed values: an `address` (20 bytes) at the low-order end of slot 2,\n  # and a `uint32` (4 bytes) just above it, written with literal offsets\n  - slot: 2\n    offset: 12\n    length: 20\n  - slot: 2\n    offset: 8\n    length: 4\n  # the same two values with the conversion `$wordsize - (o + n)` written as\n  # an expression that takes `n` from the region\'s own length\n  - slot: 2\n    offset:\n      $difference:\n        - $wordsize\n        - .length: $this\n    length: 20\n  - slot: 2\n    offset:\n      $difference:\n        - $wordsize\n        - $sum:\n            - 20\n            - .length: $this\n    length: 4\n',
  "schema:ethdebug/format/pointer/scheme/slice": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/scheme/slice"\n\ntitle: ethdebug/format/pointer/scheme/slice\ndescription: |\n  An addressing scheme for pointing to a range of sequential bytes inside\n  a data location whose structure is that of a regular bytes array\n  (i.e., where bytes are indexed by byte offset, with no concept of word).\n\ntype: object\n\nproperties:\n  offset:\n    description: |\n      The index of the byte (starting from zero) in the data location where\n      the slice begins.\n    $ref: "schema:ethdebug/format/pointer/expression"\n  length:\n    description: |\n      The length of the slice in number of bytes.\n    $ref: "schema:ethdebug/format/pointer/expression"\n\nrequired:\n  - offset\n  - length\n\nexamples:\n  - offset: 0\n    length: 32\n',
  "schema:ethdebug/format/pointer/template": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer/template"\n\ntitle: ethdebug/format/pointer/template\ndescription: |\n  A schema for representing a pointer defined in terms of some variables whose\n  values are to be provided when invoking the template.\n\ntype: object\nproperties:\n  expect:\n    title: Template variables\n    description: |\n      An array of variable identifiers used in the definition of the\n      pointer template.\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/pointer/identifier"\n\n  for:\n    $ref: "schema:ethdebug/format/pointer"\n\nrequired:\n  - expect\n  - for\n\nadditionalProperties: false\n\nexamples:\n  - expect: ["slot"]\n    for:\n      location: storage\n      slot: "slot"\n',
  "schema:ethdebug/format/pointer": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/pointer"\n\ntitle: ethdebug/format/pointer\ndescription: |\n  A schema for representing a pointer to a data position or a range of data\n  positions in the EVM.\n\n  An **ethdebug/format/pointer** is either a single region or a structured\n  collection of other pointers.\n\ntype: object\n\nif:\n  required: [location]\nthen:\n  $ref: "schema:ethdebug/format/pointer/region"\nelse:\n  $ref: "schema:ethdebug/format/pointer/collection"\n\nexamples:\n  - # example: a single particular storage slot\n    location: storage\n    slot: 2\n\n  - # example `uint256[] memory` allocation pointer\n    define:\n      "uint256-array-memory-pointer-slot": 0\n    in:\n      # this pointer composes an ordered list of other pointers\n      group:\n        # declare the first sub-pointer to be the "array-start" region of data\n        # corresponding to the first item in the stack (at time of observation)\n        - name: "array-start"\n          location: stack\n          slot: "uint256-array-memory-pointer-slot"\n\n        # declare the "array-count" region to be at the offset indicated by\n        # the value at "array-start"\n        - name: "array-count"\n          location: memory\n          offset:\n            $read: "array-start"\n          length: $wordsize\n\n        # thirdly, declare a sub-pointer that is a dynamic list whose size is\n        # indicated by the value at "array-count", where each "item-index"\n        # corresponds to a discrete "array-item" region\n        - list:\n            count:\n              $read: "array-count"\n            each: "item-index"\n            is:\n              name: "array-item"\n              location: "memory"\n              offset:\n                # array items are positioned so that the item with index 0\n                # immediately follows "array-count", and each subsequent item\n                # immediately follows the previous.\n                $sum:\n                  - .offset: "array-count"\n                  - .length: "array-count"\n                  - $product:\n                      - "item-index"\n                      - .length: $this\n              length: $wordsize\n\n  - # example `struct Record { uint8 x; uint8 y; bytes4 salt; }` in storage\n    #\n    # this example defines the "packed-field" template inline and demonstrates\n    # how templates can be reused with `yields` to rename regions.\n    # each field is placed by packing right-to-left from the previous offset.\n    templates:\n      packed-field:\n        expect:\n          - "struct-storage-contract-variable-slot"\n          - "previous"\n          - "size"\n        for:\n          name: "field"\n          location: storage\n          slot: "struct-storage-contract-variable-slot"\n          offset:\n            $difference: ["previous", "size"]\n          length: "size"\n    in:\n      define:\n        "struct-storage-contract-variable-slot": 0\n      in:\n        group:\n          # sentinel region marking where packing begins (end of word)\n          - name: "packing-begin"\n            location: storage\n            slot: "struct-storage-contract-variable-slot"\n            offset: $wordsize\n            length: 0\n\n          - define: { previous: { .offset: "packing-begin" }, size: 1 }\n            in:\n              template: "packed-field"\n              yields: { "field": "x" }\n\n          - define: { previous: { .offset: "x" }, size: 1 }\n            in:\n              template: "packed-field"\n              yields: { "field": "y" }\n\n          - define: { previous: { .offset: "y" }, size: 4 }\n            in:\n              template: "packed-field"\n              yields: { "field": "salt" }\n\n  - # example `(struct Record { uint256 x; uint256 y; })[] memory`\n    group:\n      # declare the first sub-pointer to be the "array-start" region of data\n      # corresponding to the first item in the stack (at time of observation)\n      - name: "array-start"\n        location: stack\n        slot: 0\n\n      # declares the "array-count" region in memory at the offset indicated\n      # by "array-start" and of length equal to word size\n      - name: "array-count"\n        location: memory\n        offset:\n          $read: "array-start"\n        length: $wordsize\n\n      # declare this to include a list of pointers of size indicated by the\n      # value at "array-count", where each "item-index" corresponds to a\n      # group of pointers\n      - list:\n          count:\n            $read: "array-count"\n          each: "item-index"\n          is:\n            group:\n              # each element in the list includes a "struct-pointer" region\n              # in memory (laid out sequentially in a block as the raw\n              # array data)\n              - name: "struct-pointer"\n                location: memory\n                offset:\n                  $sum:\n                    - .offset: "array-count"\n                    - .length: "array-count"\n                    - $product:\n                        - "item-index"\n                        - .length: $this\n                length: $wordsize\n\n              # following that pointer leads to the region corresponding to\n              # the first member of the struct\n              - name: "struct-member-0"\n                location: memory\n                offset:\n                  $read: "struct-pointer"\n                length: $wordsize\n\n              # the second struct member immediately follows the first\n              - name: "struct-member-1"\n                location: memory\n                offset:\n                  $sum:\n                    - .offset: "struct-member-0"\n                    - .length: "struct-member-0"\n                length: $wordsize\n\n  - # example `string storage` allocation\n    define:\n      "string-storage-contract-variable-slot": 0\n    in:\n      group:\n        # for short strings, the length is stored as 2n in the last byte of slot\n        - name: "length-flag"\n          location: storage\n          slot: "string-storage-contract-variable-slot"\n          offset:\n            $difference: [$wordsize, 1]\n          length: 1\n\n        # define the region representing the string data itself conditionally\n        # based on odd or even length data\n        - if:\n            $remainder:\n              - $sum:\n                  - $read: "length-flag"\n                  - 1\n              - 2\n\n          # short string case (flag is even)\n          then:\n            define:\n              "string-length":\n                $quotient: [{ $read: "length-flag" }, 2]\n            in:\n              name: "string"\n              location: storage\n              slot: "string-storage-contract-variable-slot"\n              offset: 0\n              length: "string-length"\n\n          # long string case (flag is odd)\n          else:\n            group:\n              # long strings may use full word to describe length as 2n+1\n              - name: "long-string-length-data"\n                location: storage\n                slot: "string-storage-contract-variable-slot"\n                offset: 0\n                length: $wordsize\n\n              - define:\n                  "string-length":\n                    $quotient:\n                      - $difference:\n                          - $read: "long-string-length-data"\n                          - 1\n                      - 2\n\n                  "start-slot":\n                    $keccak256:\n                      - $wordsized: "string-storage-contract-variable-slot"\n\n                  "total-slots":\n                    # account for both zero and nonzero slot remainders by adding\n                    # $wordsize-1 to the length before dividing\n                    $quotient:\n                      - $sum: ["string-length", { $difference: [$wordsize, 1] }]\n                      - $wordsize\n                in:\n                  list:\n                    count: "total-slots"\n                    each: "i"\n                    is:\n                      define:\n                        "current-slot":\n                          $sum: ["start-slot", "i"]\n                        "previous-length":\n                          $product: ["i", $wordsize]\n                      in:\n                        # conditional based on whether this is the last slot:\n                        # is the string length longer than the previous length\n                        # plus this whole slot?\n                        if:\n                          $difference:\n                            - "string-length"\n                            - $sum: ["previous-length", "$wordsize"]\n                        then:\n                          # include the whole slot\n                          name: "string"\n                          location: storage\n                          slot: "current-slot"\n                        else:\n                          # include only what\'s left in the string\n                          name: "string"\n                          location: storage\n                          slot: "current-slot"\n                          offset: 0\n                          length:\n                            $difference: ["string-length", "previous-length"]\n\n  - # example `string storage` (long form) as a single multi-slot region\n    #\n    # this is the same long-string body as the previous example, collapsed\n    # to one region. Because a segment\'s length may run across slots (see\n    # the segment addressing scheme), the whole string is a single region\n    # beginning at "start-slot"; no per-slot list or last-slot trim is\n    # needed, and the compiler emits far less. The per-slot list form above\n    # remains useful when a consumer wants a distinct region per slot.\n    define:\n      "string-storage-slot": 0\n    in:\n      group:\n        - name: "long-string-length-data"\n          location: storage\n          slot: "string-storage-slot"\n          offset: 0\n          length: $wordsize\n\n        - define:\n            "string-length":\n              $quotient:\n                - $difference:\n                    - $read: "long-string-length-data"\n                    - 1\n                - 2\n\n            "start-slot":\n              $keccak256:\n                - $wordsized: "string-storage-slot"\n          in:\n            name: "string"\n            location: storage\n            slot: "start-slot"\n            offset: 0\n            length: "string-length"\n',
  "schema:ethdebug/format/program/context/code": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/code"\n\ntitle: ethdebug/format/program/context/code\ndescription: |\n  Information about the source code range corresponding to this point in\n  machine execution.\n\ntype: object\nproperties:\n  code:\n    $ref: "schema:ethdebug/format/materials/source-range"\nrequired:\n  - code\n\nexamples:\n  - code:\n      source:\n        id: 5\n      range:\n        offset: 68\n        length: 16\n',
  "schema:ethdebug/format/program/context/frame": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/frame"\n\ntitle: ethdebug/format/program/context/frame\ndescription: |\n  A context may specify a `"frame"` property to indicate that its facts apply\n  only to one of several possible compilation frames, e.g. for compilers with\n  distinct frontend/backends to specify debugging data for the IR separately\n  from the debugging data for the source language.\ntype: object\nproperties:\n  frame:\n    title: Relevant compilation frame\n    type: string\nrequired:\n  - frame\n\nexamples:\n  - frame: "ir"\n  - frame: "source"\n',
  "schema:ethdebug/format/program/context/function/invoke": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/function/invoke"\n\ntitle: ethdebug/format/program/context/function/invoke\ndescription: |\n  This context indicates that the marked instruction is\n  associated with a function invocation. The invocation is one\n  of three kinds: an internal call via JUMP, an external message\n  call (CALL / DELEGATECALL / STATICCALL), or a contract\n  creation (CREATE / CREATE2).\n\n  Extends the function identity schema with kind-specific fields\n  such as call targets, gas, value, and input data.\n\n  Per the **ethdebug/format/program/instruction** schema, an\n  instruction\'s context holds following that instruction\'s\n  execution: the context\'s semantic facts (e.g., "a function was\n  invoked") hold from that point forward, and pointers within\n  the context resolve against the machine state after the\n  instruction has executed. The operand pointers of an external\n  call or contract creation are the one exception, described\n  below.\n\n  For internal calls, this context is typically placed on the\n  callee\'s entry JUMPDEST. The caller\'s JUMP has consumed its\n  destination operand by then, and JUMPDEST leaves the stack\n  unchanged, so after it executes the remaining stack (return\n  address, arguments) is stable and directly addressable.\n\n  For external calls and contract creations, this context marks\n  the CALL/DELEGATECALL/STATICCALL/CREATE/CREATE2 instruction\n  itself: the invocation occurs when that instruction executes.\n  The pointer fields of a `message` or `create` invocation\n  (`target`, `gas`, `value`, `input`, `salt`) describe the\n  operands of the marked instruction, which the instruction\n  consumes. These pointers therefore resolve against the machine\n  state immediately **before** the marked instruction executes.\n\ntype: object\nproperties:\n  invoke:\n    type: object\n    title: Function invocation\n    description: |\n      Describes the function invocation associated with this\n      context. Must indicate exactly one invocation kind: `jump`\n      for an internal call, `message` for an external call, or\n      `create` for a contract creation.\n\n    $ref: "schema:ethdebug/format/program/context/function"\n\n    properties:\n      activation:\n        type: string\n        title: Activation identifier\n        description: |\n          Correlation identifier pairing this invocation with its\n          matching return or revert. The invoke that opens an\n          activation and the return or revert that closes it carry\n          the same value; distinct activations carry distinct\n          values, unique within the program. Lets a debugger pair a\n          call with its return independent of trace order. Optional.\n\n    allOf:\n      - oneOf:\n          - required: [jump]\n          - required: [message]\n          - required: [create]\n      - if:\n          required: [jump]\n        then:\n          $ref: "#/$defs/InternalCall"\n      - if:\n          required: [message]\n        then:\n          $ref: "#/$defs/ExternalCall"\n      - if:\n          required: [create]\n        then:\n          $ref: "#/$defs/ContractCreation"\n\n    unevaluatedProperties: false\n\nrequired:\n  - invoke\n\n$defs:\n  InternalCall:\n    title: Internal call\n    description: |\n      An internal function call within the same contract. This\n      context is typically placed on the callee\'s entry JUMPDEST;\n      the caller\'s JUMP has already consumed the destination from\n      the stack, so pointer slot values reflect the post-JUMP\n      layout.\n    type: object\n    properties:\n      jump:\n        description: |\n          Indicates this is an internal function call (JUMP/JUMPI).\n        const: true\n\n      target:\n        type: object\n        title: Invocation target\n        description: |\n          Pointer to the target of the invocation. For internal\n          calls, this typically points to a code location.\n          Optional: may be omitted when there is no meaningful\n          target pointer to record, e.g., at the first\n          instruction of an inlined function body where the\n          inlining pass has elided the JUMP that would normally\n          carry this pointer. The callee identity\n          (`identifier`, `declaration`, `type`) is still\n          meaningful in this case.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      arguments:\n        type: object\n        title: Function arguments\n        description: |\n          Pointer to the arguments for an internal function call.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n    required: [jump]\n\n  ExternalCall:\n    title: External call\n    description: |\n      An external message call to another contract via CALL,\n      DELEGATECALL, or STATICCALL. Set `delegate` or `static` to\n      `true` to indicate the call variant; if neither is present\n      the call is a regular CALL.\n\n      This context marks the call instruction itself. The `target`,\n      `gas`, `value`, and `input` pointers describe that\n      instruction\'s operands, so they resolve against the machine\n      state immediately **before** it executes.\n    type: object\n    properties:\n      message:\n        description: |\n          Indicates this is an external message call (CALL,\n          DELEGATECALL, or STATICCALL).\n        const: true\n\n      target:\n        type: object\n        title: Invocation target\n        description: |\n          Pointer to the target of the invocation. For external\n          calls, this points to the address and/or selector\n          being called.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      gas:\n        type: object\n        title: Gas allocation\n        description: |\n          Pointer to the gas allocated for the external call.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      value:\n        type: object\n        title: ETH value\n        description: |\n          Pointer to the amount of ETH being sent with the call.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      input:\n        type: object\n        title: Call input data\n        description: |\n          Pointer to the input data for the external call.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      delegate:\n        description: |\n          Indicates this external call is a DELEGATECALL.\n        const: true\n\n      static:\n        description: |\n          Indicates this external call is a STATICCALL.\n        const: true\n\n    not:\n      description: Only one of `delegate` and `static` can be set at a time.\n      required: [delegate, static]\n\n    required: [message, target]\n\n  ContractCreation:\n    title: Contract creation\n    description: |\n      A contract creation via CREATE or CREATE2. The presence\n      of `salt` distinguishes CREATE2 from CREATE.\n\n      This context marks the CREATE or CREATE2 instruction itself.\n      The `value`, `salt`, and `input` pointers describe that\n      instruction\'s operands, so they resolve against the machine\n      state immediately **before** it executes.\n    type: object\n    properties:\n      create:\n        description: |\n          Indicates this is a contract creation operation\n          (CREATE or CREATE2).\n        const: true\n\n      value:\n        type: object\n        title: ETH value\n        description: |\n          Pointer to the amount of ETH being sent with the\n          creation.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      salt:\n        type: object\n        title: CREATE2 salt\n        description: |\n          Pointer to the salt value for CREATE2. Its presence\n          implies this is a CREATE2 operation.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      input:\n        type: object\n        title: Creation bytecode\n        description: |\n          Pointer to the creation bytecode for the new contract.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n    required: [create]\n\nexamples:\n  # -----------------------------------------------------------\n  # Internal call: transfer(address, uint256)\n  # -----------------------------------------------------------\n  # This context would mark the JUMPDEST at the entry of the\n  # `transfer` function. The caller\'s JUMP has consumed the\n  # destination from the stack, leaving (top first):\n  #\n  #   slot 0: return label\n  #   slot 1: first argument  (`to`)\n  #   slot 2: second argument (`amount`)\n  #\n  # The `target` pointer identifies the function\'s entry point\n  # in the bytecode; `arguments` uses a group to name each\n  # argument\'s stack position.\n  - invoke:\n      identifier: "transfer"\n      declaration:\n        source:\n          id: 0\n        range:\n          offset: 128\n          length: 95\n      type:\n        id: 7\n      jump: true\n      target:\n        pointer:\n          location: code\n          offset: "0x100"\n          length: 1\n      arguments:\n        pointer:\n          group:\n            - name: "to"\n              location: stack\n              slot: 1\n            - name: "amount"\n              location: stack\n              slot: 2\n      # The matching return context carries the same `activation`\n      # value, pairing this call with its return.\n      activation: "transfer#0"\n\n  # -----------------------------------------------------------\n  # Inlined internal call: no target pointer\n  # -----------------------------------------------------------\n  # When the compiler inlines a function, the JUMP that would\n  # normally carry the invoke context has been elided \u2014 there\n  # is no physical call instruction and no code target to\n  # point at. The invoke context still records the callee\'s\n  # identity so the debugger can maintain a source-level call\n  # stack, and a `transform: ["inline"]` context annotates the\n  # inlining \u2014 composed flat alongside the invoke on the same\n  # context object (the two carry disjoint keys).\n  - invoke:\n      identifier: "transfer"\n      declaration:\n        source:\n          id: 0\n        range:\n          offset: 128\n          length: 95\n      jump: true\n      # Correlation id: the matching inlined `return` carries the\n      # same value, so the two pair even if `transfer` is inlined\n      # at several sites.\n      activation: "transfer#0"\n\n  # -----------------------------------------------------------\n  # External CALL: token.balanceOf(account)\n  # -----------------------------------------------------------\n  # This context marks the CALL instruction. Its pointers\n  # describe the operands of the CALL, so they resolve against\n  # the state before the CALL executes (CALL consumes all of\n  # its stack operands):\n  #\n  #   slot 0: gas to forward\n  #   slot 1: target contract address\n  #   slot 2: value (0 \u2014 balanceOf is non-payable)\n  #\n  # The ABI-encoded calldata has already been written to\n  # memory at 0x80:\n  #\n  #   0x80..0x83: function selector     (4 bytes)\n  #   0x84..0xa3: abi-encoded `account` (32 bytes)\n  - invoke:\n      identifier: "balanceOf"\n      message: true\n      target:\n        pointer:\n          location: stack\n          slot: 1\n      gas:\n        pointer:\n          location: stack\n          slot: 0\n      value:\n        pointer:\n          location: stack\n          slot: 2\n      input:\n        pointer:\n          group:\n            - name: "selector"\n              location: memory\n              offset: "0x80"\n              length: 4\n            - name: "arguments"\n              location: memory\n              offset: "0x84"\n              length: "0x20"\n\n  # -----------------------------------------------------------\n  # DELEGATECALL: proxy forwarding calldata\n  # -----------------------------------------------------------\n  # This context marks a DELEGATECALL instruction in a proxy\n  # contract. The call executes the implementation\'s code\n  # within the proxy\'s storage context. The pointers describe\n  # the operands of the DELEGATECALL, so they resolve against\n  # the state before it executes (DELEGATECALL consumes all of\n  # its stack operands):\n  #\n  #   slot 0: gas\n  #   slot 1: implementation address\n  #\n  # The original calldata has been copied into memory:\n  #\n  #   0x80..0xe3: forwarded calldata (100 bytes)\n  - invoke:\n      message: true\n      delegate: true\n      target:\n        pointer:\n          location: stack\n          slot: 1\n      gas:\n        pointer:\n          location: stack\n          slot: 0\n      input:\n        pointer:\n          location: memory\n          offset: "0x80"\n          length: "0x64"\n\n  # -----------------------------------------------------------\n  # CREATE2: deploying a child contract\n  # -----------------------------------------------------------\n  # This context marks the CREATE2 instruction. The pointers\n  # describe the operands of the CREATE2, so they resolve\n  # against the state before it executes (CREATE2 consumes all\n  # of its stack operands). The EVM stack layout for\n  # CREATE2 (top first):\n  #\n  #   slot 0: value  (ETH to send to the new contract)\n  #   slot 1: offset (memory offset of init code)\n  #   slot 2: length (byte length of init code)\n  #   slot 3: salt   (for deterministic address derivation)\n  #\n  # The init code has been placed in memory:\n  #\n  #   0x80..0x027f: creation bytecode (512 bytes)\n  - invoke:\n      create: true\n      value:\n        pointer:\n          location: stack\n          slot: 0\n      salt:\n        pointer:\n          location: stack\n          slot: 3\n      input:\n        pointer:\n          location: memory\n          offset: "0x80"\n          length: "0x200"\n',
  "schema:ethdebug/format/program/context/function/return": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/function/return"\n\ntitle: ethdebug/format/program/context/function/return\ndescription: |\n  This context indicates that the marked instruction is\n  associated with a successful function return. Extends the\n  function identity schema with an optional pointer to the\n  return data and, for external calls, the success status.\n\n  All fields are optional. A bare `return: {}` is permitted\n  when the compiler knows a return occurred but has no further\n  detail\u2014for example, at a tail-call-optimized back-edge where\n  the intermediate return value is not materialized, or for a\n  void function with no return value.\n\ntype: object\nproperties:\n  return:\n    type: object\n\n    $ref: "schema:ethdebug/format/program/context/function"\n\n    properties:\n      data:\n        type: object\n        title: Return data\n        description: |\n          Pointer to the data being returned from the function.\n          Optional: may be omitted when no return value is\n          observable at this instruction (e.g., void functions,\n          tail-call-optimized returns where the intermediate\n          value is not materialized).\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      success:\n        type: object\n        title: Call success status\n        description: |\n          Pointer to the success status of an external call.\n          Typically points to a boolean value on the stack.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      activation:\n        type: string\n        title: Activation identifier\n        description: |\n          Correlation identifier for the activation this return\n          ends. Matches the `activation` on the `invoke` that\n          opened the same activation; distinct activations carry\n          distinct values, unique within the program. Lets a\n          debugger pair a return with its invocation independent\n          of trace order. Optional.\n\n    unevaluatedProperties: false\n\nrequired:\n  - return\n\nexamples:\n  # -----------------------------------------------------------\n  # Internal return: transfer(address, uint256) returns (bool)\n  # -----------------------------------------------------------\n  # This context would mark the JUMP instruction that returns\n  # control to the caller. The function has left its return\n  # value on the stack:\n  #\n  #   slot 0: return value (`bool success`)\n  - return:\n      identifier: "transfer"\n      declaration:\n        source:\n          id: 0\n        range:\n          offset: 128\n          length: 95\n      data:\n        pointer:\n          location: stack\n          slot: 0\n      # Same `activation` value as the opening `invoke`, pairing\n      # this return with its call.\n      activation: "transfer#0"\n\n  # -----------------------------------------------------------\n  # External call return: processing result of a CALL\n  # -----------------------------------------------------------\n  # This context would mark an instruction on the path that\n  # follows a CALL that completed successfully. The EVM places\n  # a success flag on the stack, and the callee\'s return data\n  # is accessible via the returndata buffer. After the marked\n  # instruction executes:\n  #\n  #   stack slot 0: success flag (1 = success)\n  #   returndata 0x00..0x1f: ABI-encoded return value (32 bytes)\n  - return:\n      data:\n        pointer:\n          location: returndata\n          offset: 0\n          length: "0x20"\n      success:\n        pointer:\n          location: stack\n          slot: 0\n\n  # -----------------------------------------------------------\n  # Minimal return: only the data pointer\n  # -----------------------------------------------------------\n  # When the compiler cannot attribute the return to a named\n  # function, the context may contain only the return data.\n  # Here, a single stack value is being returned.\n  #\n  #   slot 0: return value\n  - return:\n      data:\n        pointer:\n          location: stack\n          slot: 0\n\n  # -----------------------------------------------------------\n  # Return without observable data: TCO back-edge\n  # -----------------------------------------------------------\n  # At a tail-call-optimized back-edge JUMP, the intermediate\n  # return value is not materialized on the stack \u2014 it would\n  # have been the argument to the next iteration, which the\n  # compiler has already folded into the new call\'s setup.\n  # A return semantically happens (the outer activation\'s\n  # iteration N is returning), but there is no pointer to\n  # record for `data`.\n  - return:\n      identifier: "fact"\n      declaration:\n        source:\n          id: 0\n        range:\n          offset: 64\n          length: 120\n',
  "schema:ethdebug/format/program/context/function/revert": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/function/revert"\n\ntitle: ethdebug/format/program/context/function/revert\ndescription: |\n  This context indicates that the marked instruction is\n  associated with a function revert. Extends the function\n  identity schema with an optional pointer to revert reason\n  data and/or a numeric panic code.\n\ntype: object\nproperties:\n  revert:\n    type: object\n\n    $ref: "schema:ethdebug/format/program/context/function"\n\n    properties:\n      reason:\n        type: object\n        title: Revert reason\n        description: |\n          Pointer to the revert reason data. This typically contains\n          an ABI-encoded error message or custom error data.\n        properties:\n          pointer:\n            $ref: "schema:ethdebug/format/pointer"\n        required:\n          - pointer\n        additionalProperties: false\n\n      panic:\n        type: integer\n        title: Panic code\n        description: |\n          Numeric panic code for built-in assertion failures.\n          Languages may define their own panic code conventions\n          (e.g., Solidity uses codes like 0x11 for arithmetic\n          overflow).\n\n      activation:\n        type: string\n        title: Activation identifier\n        description: |\n          Correlation identifier for the activation this revert\n          ends. Matches the `activation` on the `invoke` that\n          opened the same activation; distinct activations carry\n          distinct values, unique within the program. Lets a\n          debugger pair an abnormal exit with its invocation\n          independent of trace order. Optional.\n\n    unevaluatedProperties: false\n\nrequired:\n  - revert\n\nexamples:\n  # -----------------------------------------------------------\n  # Revert with reason: require() failure in transfer\n  # -----------------------------------------------------------\n  # This context would mark the REVERT instruction after a\n  # failed require(). The compiler has written the ABI-encoded\n  # Error(string) revert reason into memory:\n  #\n  #   0x80..0xe3: ABI-encoded Error(string) (100 bytes)\n  #               selector 0x08c379a0 + offset + length + data\n  - revert:\n      identifier: "transfer"\n      reason:\n        pointer:\n          location: memory\n          offset: "0x80"\n          length: "0x64"\n\n  # -----------------------------------------------------------\n  # Panic: arithmetic overflow (code 0x11)\n  # -----------------------------------------------------------\n  # A built-in safety check detected an arithmetic overflow.\n  # The panic code alone identifies the failure; no pointer to\n  # revert data is needed since the compiler inserts the check\n  # itself.\n  - revert:\n      panic: 17\n\n  # -----------------------------------------------------------\n  # External call revert: processing a failed CALL\n  # -----------------------------------------------------------\n  # This context would mark an instruction after a CALL that\n  # reverted. The callee\'s revert reason is accessible via the\n  # returndata buffer:\n  #\n  #   returndata 0x00..0x63: ABI-encoded revert reason\n  - revert:\n      reason:\n        pointer:\n          location: returndata\n          offset: 0\n          length: "0x64"\n',
  "schema:ethdebug/format/program/context/function": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/program/context/function"

title: ethdebug/format/program/context/function
description: |
  Properties for identifying a source-language function. Function
  context schemas (invoke, return, revert) extend this schema so
  that each context can optionally indicate which function it
  pertains to.

  All properties are optional so that compilers may provide as
  much or as little detail as is available.

type: object
properties:
  identifier:
    type: string
    minLength: 1
    description: |
      The function's name in the source language.

  declaration:
    description: |
      Source range where the function is declared.
    $ref: "schema:ethdebug/format/materials/source-range"

  type:
    description: |
      The function's type, specified either as a full
      ethdebug/format/type representation or a type reference.
    $ref: "schema:ethdebug/format/type/specifier"

examples:
  # All three identity fields provided: the compiler knows the
  # function name, where it was declared, and its type.
  - identifier: "transfer"
    declaration:
      source:
        id: 0
      range:
        offset: 128
        length: 95
    type:
      id: 7

  # Only the function name is known.
  - identifier: "balanceOf"

  # No identity information. The compiler knows that a function
  # context applies but cannot attribute it to a specific
  # function (e.g., an indirect call through a function pointer).
  - {}
`,
  "schema:ethdebug/format/program/context/gather": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/gather"\n\ntitle: ethdebug/format/program/context/gather\ndescription: |\n  A context specifying the `"gather"` property with a list of contexts\n  indicates that all specified contexts apply simultaneously.\n\ntype: object\nproperties:\n  gather:\n    title: Contexts to gather\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/program/context"\n    minItems: 2\nrequired:\n  - gather\n\nexamples:\n  - gather:\n      - frame: "ir"\n        code:\n          source:\n            id: 0\n          range:\n            offset: 8\n            length: 11\n      - frame: "source"\n        code:\n          source:\n            id: 3\n          range:\n            offset: 113\n            length: 19\n  - gather:\n      - variables:\n          - identifier: x\n            declaration:\n              source:\n                id: 5\n              range:\n                offset: 10\n                length: 56\n            type:\n              kind: string\n      - variables:\n          - identifier: x\n            declaration:\n              source:\n                id: 5\n              range:\n                offset: 10\n                length: 56\n            pointer:\n              location: storage\n              slot: 0\n',
  "schema:ethdebug/format/program/context/name": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/name"\n\ntitle: ethdebug/format/program/context/name\ndescription: |\n  An optional identifier attached to a context.\n\n  Today a `name` acts as a label. It is most useful inside a\n  `pick`, whose alternatives are listed inline: a name distinguishes\n  those alternatives from one another when several contexts may apply\n  at a point in execution.\n\n  Names are opaque strings; the format imposes no structure on them.\n  A name is meant to be unique within a program so it can identify a\n  context, but the format does **not** yet define any way to\n  reference a context by its name \u2014 so a declared name is currently\n  inert, a label only.\n\n  It is groundwork: establishing the identifier now lets a future\n  name-based `pick` selection reference an alternative by its name\n  instead of listing it inline. Compilers **should** choose names\n  that are meaningful to debugger users.\n\ntype: object\nproperties:\n  name:\n    type: string\n    minLength: 1\nrequired:\n  - name\n\nexamples:\n  # example: distinguishing a `pick` alternative\n  - name: "storage-layout-v2"\n  # example: naming a generic instantiation\n  - name: "Array<T=bytes32>"\n',
  "schema:ethdebug/format/program/context/pick": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/pick"\n\ntitle: ethdebug/format/program/context/pick\ndescription: |\n  A program context that specifies the `"pick"` property indicates that\n  one of several possible contexts are known to be true, possibly requiring\n  additional information to disambiguate.\n\ntype: object\nproperties:\n  pick:\n    title: Contexts to pick from\n    type: array\n    items:\n      $ref: "schema:ethdebug/format/program/context"\n    minItems: 2\nrequired:\n  - pick\n\nexamples:\n  - pick:\n      - code:\n          source:\n            id: 5\n          range:\n            offset: 68\n            length: 16\n      - code:\n          source:\n            id: 5\n          range:\n            offset: 132\n            length: 16\n\n  - # example: named alternatives for disambiguation\n    pick:\n      - name: "inlined-call"\n        code:\n          source:\n            id: 5\n          range:\n            offset: 68\n            length: 16\n      - name: "original-site"\n        code:\n          source:\n            id: 5\n          range:\n            offset: 132\n            length: 16\n',
  "schema:ethdebug/format/program/context/remark": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/remark"\n\ntitle: ethdebug/format/program/context/remark\ndescription: |\n  Human-readable information about the instruction. This field is intended\n  primarily not for compilers to use directly, but rather for humans\n  (directly or indirectly) to use as an annotation field.\n\ntype: object\nproperties:\n  remark:\n    type: string\n\nrequired:\n  - remark\n\nexamples:\n  - remark: "jump to end if zero"\n',
  "schema:ethdebug/format/program/context/transform": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/transform"\n\ntitle: ethdebug/format/program/context/transform\ndescription: |\n  Annotates an instruction with compiler transformations that\n  produced it. The value is a list of short identifiers naming\n  each transformation; the list may repeat an identifier when\n  the same transformation has been applied more than once (e.g.,\n  `["inline", "inline"]` for doubly-inlined code).\n\n  A transform context is *additional* annotation \u2014 it does not\n  replace semantic contexts. When the compiler inlines a\n  function, the invoke/return contexts for the logical call\n  should still be emitted at the call boundary so the debugger\'s\n  source-level call stack remains coherent. The transform\n  context tells debuggers **how** the call was realized.\n\n  Combine a transform with other discriminator keys (`invoke`,\n  `return`, `code`, etc.) by placing them side-by-side on the\n  same context object \u2014 `gather` is only needed when two\n  contexts would collide on the same key.\n\n  Consumers that ignore transform contexts still get a sound\n  source-level view from the invoke/return contexts alone.\n  Consumers that understand transform contexts can offer\n  optimization-aware presentations \u2014 e.g., rendering inlined\n  code as a collapsible block, or reconciling tail-call-optimized\n  back-edges with the logical call stack.\n\n  The identifier set is extensible. The schema defines:\n\n  - `"inline"` \u2014 the marked instruction is part of an inlined\n    function body. Surrounding invoke/return contexts name the\n    inlined callee.\n  - `"tailcall"` \u2014 the marked instruction is a\n    tail-call-optimized back-edge JUMP or continuation, where\n    the call was realized as a direct jump (or reuse of the\n    caller\'s frame) rather than a standard call/return sequence.\n  - `"fold"` \u2014 the marked instruction carries the result of a\n    compile-time constant fold. Typically a PUSH of the folded\n    value, replacing a compute sequence that appeared in source.\n  - `"coalesce"` \u2014 the marked instruction is part of a\n    read-write merging sequence (e.g., SHL/OR sequences packing\n    narrower fields into a wider word) that the user did not\n    explicitly write; the compiler introduced it to combine\n    adjacent source-level reads or writes.\n\n  Debuggers unfamiliar with a given identifier should preserve\n  it as an opaque label.\n\n  Order in the array is not semantically significant \u2014 only the\n  multiset of identifiers matters.\n\ntype: object\nproperties:\n  transform:\n    title: Applied transformations\n    description: |\n      List of transformation identifiers. Identifiers may\n      repeat; order is not semantically significant.\n    type: array\n    items:\n      type: string\n      minLength: 1\n    minItems: 1\n\nrequired:\n  - transform\n\nexamples:\n  - transform: ["inline"]\n  - transform: ["tailcall"]\n  - transform: ["fold"]\n  - transform: ["coalesce"]\n  - transform: ["inline", "inline"]\n  - transform: ["inline", "tailcall"]\n  - transform: ["inline", "fold"]\n  - transform: ["coalesce", "coalesce"]\n',
  "schema:ethdebug/format/program/context/variables": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context/variables"\n\ntitle: ethdebug/format/program/context/variables\ndescription: |\n  Information about known variables at this context\'s point in code\n  execution, specified as an array whose items each correspond to a unique\n  variable.\n\n  Items in this array **should not** have duplicate non-empty `identifier`\n  values except where high-level language semantics require it. Where\n  possible, use other mechanisms provided by this format to indicate that\n  an identifier\'s corresponding variable is ambiguous.\n\ntype: object\nproperties:\n  variables:\n    type: array\n    items:\n      $ref: "#/$defs/Variable"\n    minItems: 1\nrequired:\n  - variables\n\nexamples:\n  - variables:\n      - identifier: x\n        declaration:\n          source:\n            id: 5\n          range:\n            offset: 10\n            length: 56\n        type:\n          kind: string\n        pointer:\n          location: storage\n          slot: 0\n\n$defs:\n  Variable:\n    title: Variable\n    description: |\n      The information known about a variable at a particular point in the code\n      execution.\n\n    type: object\n    properties:\n      identifier:\n        type: string\n        minLength: 1\n\n      declaration:\n        description: |\n          Source range corresponding to where the variable was declared.\n        $ref: "schema:ethdebug/format/materials/source-range"\n\n      type:\n        description: |\n          The variable\'s static type, if it exists. This **must** be\n          specified either as a full **ethdebug/format/type**\n          representation, or an `{ "id": "..." }` type reference.\n        $ref: "schema:ethdebug/format/type/specifier"\n\n      pointer:\n        description: |\n          Allocation information for the variable, if it exists.\n        $ref: "schema:ethdebug/format/pointer"\n\n    minProperties: 1\n    unevaluatedProperties: false\n\n    examples:\n      - identifier: x\n        declaration:\n          source:\n            id: 5\n          range:\n            offset: 10\n            length: 56\n',
  "schema:ethdebug/format/program/context": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/context"\n\ntitle: ethdebug/format/program/context\ndescription: |\n  An **ethdebug/format/program/context** object represents compile-time\n  information about the high-level runtime execution state at a specific point\n  in a program\'s bytecode.\n\n  This schema provides a formal specification for this format\'s model of what\n  information can be known at compile-time about the high-level runtime. This\n  includes data such as a particular machine instruction\'s source mapping or\n  what variables exist in runtime state following some instruction.\n\n  The context object supports dynamic context combination and selection through\n  the use of `gather`, and `pick` properties. This allows for flexible\n  composition and extraction of context information.\n\n  Contexts serve as a bridge between low-level EVM execution and high-level\n  language constructs. Debuggers can use these compile-time guarantees to\n  maintain a coherent view of the high-level language runtime throughout\n  program execution. This enables debugging tools to map execution points to\n  source code, reconstruct variable states, provide meaningful stack traces,\n  and offer insights into control flow and data structures.\n\ntype: object\n\nallOf:\n  - if:\n      required: ["name"]\n    then:\n      description: |\n        A label for distinguishing this context from others.\n      $ref: "schema:ethdebug/format/program/context/name"\n  - if:\n      required: ["code"]\n    then:\n      description: |\n        The context\'s corresponding source code range.\n      $ref: "schema:ethdebug/format/program/context/code"\n  - if:\n      required: ["variables"]\n    then:\n      description: |\n        Variable definitions, types, allocations known to exist in the context.\n      $ref: "schema:ethdebug/format/program/context/variables"\n  - if:\n      required: ["remark"]\n    then:\n      description: |\n        Human-readable context annotation. Not intended for compiler use.\n      $ref: "schema:ethdebug/format/program/context/remark"\n  - if:\n      required: ["pick"]\n    then:\n      description: |\n        Alternation between several possible contexts.\n      $ref: "schema:ethdebug/format/program/context/pick"\n  - if:\n      required: ["gather"]\n    then:\n      description: |\n        Collection of multiple known, separate contexts.\n      $ref: "schema:ethdebug/format/program/context/gather"\n  - if:\n      required: ["frame"]\n    then:\n      description: |\n        For use by compilers with multiple pipeline outputs (e.g., use of an\n        intermediary representation) to associate a\n        context with a particular compiler step.\n      $ref: "schema:ethdebug/format/program/context/frame"\n  - if:\n      required: ["invoke"]\n    then:\n      description: |\n        Indicates association with a function invocation (internal call,\n        external message call, or contract creation).\n      $ref: "schema:ethdebug/format/program/context/function/invoke"\n  - if:\n      required: ["return"]\n    then:\n      description: |\n        Indicates association with a successful function return.\n      $ref: "schema:ethdebug/format/program/context/function/return"\n  - if:\n      required: ["revert"]\n    then:\n      description: |\n        Indicates association with a function revert.\n      $ref: "schema:ethdebug/format/program/context/function/revert"\n  - if:\n      required: ["transform"]\n    then:\n      description: |\n        Compiler transformations applied to produce this instruction\n        (e.g., inlining, tail-call optimization). Additional\n        annotation \u2014 does not replace semantic contexts.\n      $ref: "schema:ethdebug/format/program/context/transform"\n\nunevaluatedProperties: false\n\nexamples:\n  - variables:\n      - identifier: x\n        declaration:\n          source:\n            id: 5\n          range:\n            offset: 10\n            length: 56\n        type:\n          kind: string\n        pointer:\n          location: storage\n          slot: 0\n    code:\n      source:\n        id: 5\n      range:\n        offset: 68\n        length: 16\n',
  "schema:ethdebug/format/program/instruction": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program/instruction"\n\ntitle: ethdebug/format/program/instruction\ndescription: |\n  A schema for representing the information pertaining to a particular\n  instruction in machine code.\n\ntype: object\n\nproperties:\n  offset:\n    title: Instruction byte offset\n    description: |\n      The byte offset where the instruction begins within the bytecode.\n\n      For legacy contract bytecode (non-EOF), this value is equivalent to the\n      instruction\'s program counter. For EOF bytecode, this value **must** be\n      the offset from the start of the container, not the start of a particular\n      code section within that container.\n    $ref: "schema:ethdebug/format/data/value"\n\n  operation:\n    title: Machine operation information\n    type: object\n    properties:\n      mnemonic:\n        description: The mnemonic operation code (PUSH1, e.g.)\n        type: string\n\n      arguments:\n        description: The immediate arguments to the operation, if relevant.\n        type: array\n        minItems: 1\n        items:\n          description: |\n            An immediate value specified as argument to the opcode\n          $ref: "schema:ethdebug/format/data/value"\n\n    required:\n      - mnemonic\n\n  context:\n    description: |\n      The context that holds **following** the execution of this\n      instruction. Both its semantic facts (source location, variables in\n      scope, function invocation, etc.) and any pointers it contains resolve\n      against the machine state **after** the instruction has executed\n      (its postcondition). The one exception is the operand pointers of\n      an external call or contract creation in\n      **ethdebug/format/program/context/function/invoke**: they describe\n      what the marked instruction consumes, so they resolve against the\n      state immediately before it executes.\n\n      Instruction contexts form a chain. The program-level `context` is the\n      base case: the precondition that holds before the first instruction\n      executes. Each instruction\'s context is then the postcondition of that\n      instruction, which is in turn the precondition of the next. A debugger\n      paused at the trace step about to execute instruction *i* therefore\n      reads the context of instruction *i \u2212 1* \u2014 or, before the first\n      instruction, the program-level `context`. Equivalently, prepending\n      the program-level `context` to the sequence of instruction contexts\n      yields a single sequence indexed by trace position, with no special\n      case: the context in effect when about to execute the instruction at\n      position *i* is element *i* of that sequence.\n\n      This field is **optional**. Omitting it is equivalent to specifying the\n      empty context value (`{}`).\n    $ref: "schema:ethdebug/format/program/context"\n    default: {}\n\nrequired:\n  - offset\n\nunevaluatedProperties: false\n\nexamples:\n  - offset: 0\n    operation:\n      mnemonic: "PUSH1"\n      arguments: ["0x60"]\n    context:\n      code:\n        source:\n          id: 5\n        range:\n          offset: 10\n          length: 30\n',
  "schema:ethdebug/format/program": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/program"\n\ntitle: ethdebug/format/program\ndescription: |\n  Debugging information about a particular bytecode in a compilation.\n\ntype: object\n\nproperties:\n  ethdebug:\n    title: Stamp\n    description: |\n      Names this schema and the specification version. A program\n      emitted outside an info document should carry this field. A\n      program inside an info document (in `programs`) should not; the\n      stamp of the info document covers it.\n    allOf:\n      - $ref: "schema:ethdebug/format/data/stamp"\n      # note: whitespace chars are \\255 (nbsp)\n      - title: \'{\xA0"schema":\xA0"ethdebug/format/program"\xA0}\'\n        properties:\n          schema:\n            const: "ethdebug/format/program"\n\n  compilation:\n    title: Compilation reference by ID\n    description: |\n      A reference to the compilation as an `{ "id": ... }` object.\n    $ref: "schema:ethdebug/format/materials/reference"\n\n  contract:\n    type: object\n    properties:\n      name:\n        type: string\n\n      definition:\n        $ref: "schema:ethdebug/format/materials/source-range"\n    required:\n      - definition\n\n  environment:\n    title: Bytecode execution environment\n    description: |\n      Whether this bytecode is for contract creation or runtime calls.\n    type: string\n    enum:\n      - call\n      - create\n\n  context:\n    description: |\n      The context that holds prior to the execution of the first\n      instruction in the bytecode. This is the base case of the context\n      chain \u2014 the precondition to the first instruction \u2014 from which each\n      instruction\'s own `context` follows as a postcondition (see\n      **ethdebug/format/program/instruction**).\n\n      This field is **optional**. Omitting it is equivalent to specifying the\n      empty context value (`{}`).\n    $ref: "schema:ethdebug/format/program/context"\n    default: {}\n\n  instructions:\n    type: array\n    description: |\n      The full array of instructions for the bytecode.\n    items:\n      $ref: "schema:ethdebug/format/program/instruction"\n\nrequired:\n  - contract\n  - environment\n  - instructions\n\nunevaluatedProperties: false\n\nexamples:\n  - # Incrementing a storage counter\n    #\n    # This example represents the call bytecode for the following pseudo-code:\n    # ```\n    # contract Incrementer;\n    #\n    # storage {\n    #   [0] storedValue: uint256;\n    # };\n    #\n    # code {\n    #   let localValue = storedValue;\n    #   storedValue += 1;\n    # };\n    # ```\n    ethdebug:\n      schema: "ethdebug/format/program"\n      version: "0.1.0-draft.1"\n    contract:\n      name: "Incrementer"\n      definition:\n        source:\n          id: 0\n    environment: call\n    context:\n      variables:\n        - &stored-value\n          identifier: storedValue\n          type:\n            kind: uint\n            bits: 256\n          pointer:\n            location: storage\n            slot: 0\n    instructions:\n      - offset: 0\n        operation:\n          mnemonic: PUSH0\n        context:\n          variables:\n            - *stored-value\n      - offset: 1\n        operation:\n          mnemonic: SLOAD\n        context:\n          variables:\n            - *stored-value\n            - &local-value\n              identifier: localValue\n              type:\n                kind: uint\n                bits: 256\n              pointer:\n                location: stack\n                slot: 0\n      - offset: 2\n        operation:\n          mnemonic: PUSH1\n          arguments: ["0x01"]\n        context:\n          variables:\n            - *stored-value\n            - <<: *local-value\n              pointer:\n                location: stack\n                slot: 1\n\n      - offset: 4\n        operation:\n          mnemonic: ADD\n        # ADD consumes localValue, leaving storedValue + 1 on the stack,\n        # so localValue is no longer observable from this point on.\n        context:\n          variables:\n            - *stored-value\n      - offset: 5\n        operation:\n          mnemonic: PUSH0\n        context:\n          variables:\n            - *stored-value\n\n      - offset: 6\n        operation:\n          mnemonic: SSTORE\n        context:\n          variables:\n            - *stored-value\n',
  "schema:ethdebug/format/type/base": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/base"\n\ntitle: ethdebug/format/type/base\ndescription: Defines the minimally necessary schema for a data type.\n  Types belong to a particular `class` (`"elementary"` or `"complex"`),\n  and are further identified by a particular `kind`.\ntype: object\noneOf:\n  - $ref: "#/$defs/ElementaryType"\n  - $ref: "#/$defs/ComplexType"\n\n$defs:\n  ElementaryType:\n    title: Base elementary type\n    description: Represents an elementary type (one that does not compose other types)\n    type: object\n    properties:\n      class:\n        type: string\n        const: elementary\n      kind:\n        type: string\n      contains:\n        not:\n          description: "Elementary types **must not** specify a `contains` field\n            (to make it easier to discriminate elementary vs. complex)"\n    required:\n      - kind\n    examples:\n      - kind: uint\n        bits: 256\n\n  ComplexType:\n    title: Base complex type\n    description:\n      Represents a complex type, one that composes other types (e.g., arrays,\n      structs, mappings)\n    type: object\n    properties:\n      class:\n        type: string\n        const: complex\n        description: Indicates that this is a complex type\n      kind:\n        type: string\n        description: The specific kind of complex type, e.g., array or struct\n      contains:\n        title: Complex type `contains` field\n        description:\n          Either a type wrapper, an array of type wrappers, or an object\n          mapping to type wrappers.\n        oneOf:\n          - $ref: "#/$defs/TypeWrapper"\n          - $ref: "#/$defs/TypeWrapperArray"\n          - $ref: "#/$defs/TypeWrapperObject"\n\n    required:\n      - kind\n      - contains\n    examples:\n      - kind: array\n        contains:\n          type:\n            kind: uint\n            bits: 256\n      - kind: struct\n        contains:\n          - name: x\n            type:\n              kind: uint\n              bits: 256\n          - name: y\n            type:\n              kind: uint\n              bits: 256\n      - kind: mapping\n        contains:\n          key:\n            type:\n              kind: address\n              payable: true\n          value:\n            type:\n              kind: uint\n              bits: 256\n\n  TypeWrapper:\n    title: \'{ "type": ... }\'\n    description:\n      A wrapper around a type. Defines a `"type"` field that may include a full\n      Type representation or a reference to a known Type by ID. Note that this\n      schema permits additional properties on the same object.\n    type: object\n    properties:\n      type:\n        oneOf:\n          - $ref: "schema:ethdebug/format/type/base"\n          - $ref: "schema:ethdebug/format/type/reference"\n\n    required:\n      - type\n\n  TypeWrapperArray:\n    title: \'{ "type": ... }[]\'\n    description: A list of wrapped types, where the wrapper may add fields\n    type: array\n    items:\n      $ref: "#/$defs/TypeWrapper"\n\n  TypeWrapperObject:\n    title: \'{ "key": { "type": ... }, ... }\'\n    description: A key-value mapping of wrapped types, where the wrapper may add fields\n    type: object\n    additionalProperties:\n      $ref: "#/$defs/TypeWrapper"\n',
  "schema:ethdebug/format/type/complex/alias": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/alias"\n\ntitle: ethdebug/format/type/complex/alias\ndescription: Schema representing a type alias to another type\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: alias\n  contains:\n    $ref: "schema:ethdebug/format/type/wrapper"\n  definition:\n    $ref: "schema:ethdebug/format/type/definition"\n\nrequired:\n  - kind\n  - contains\n\nexamples:\n  - kind: alias\n    contains:\n      type:\n        kind: uint\n        bits: 256\n\n  - kind: alias\n    contains:\n      type:\n        kind: array\n        contains:\n          type:\n            class: elementary\n            kind: super-uint # unsupported type\n            blits: -256\n',
  "schema:ethdebug/format/type/complex/array": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/array"\n\ntitle: ethdebug/format/type/complex/array\ndescription: |\n  Schema for representing array types, both fixed-size and dynamically\n  sized. An array type specifies the element type it contains and,\n  optionally, a fixed element count.\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: array\n  contains:\n    description: |\n      The element type contained by this array, specified as an\n      **ethdebug/format/type/wrapper**.\n    $ref: "schema:ethdebug/format/type/wrapper"\n  count:\n    description: |\n      The fixed number of elements in this array. When omitted, the array\n      is dynamically sized.\n    $ref: "schema:ethdebug/format/data/value"\n\nrequired:\n  - kind\n  - contains\n\nexamples:\n  # example: a dynamically-sized array of uint256\n  - kind: array\n    contains:\n      type:\n        kind: uint\n        bits: 256\n\n  # example: a fixed-size array of 10 addresses\n  - kind: array\n    count: 10\n    contains:\n      type:\n        kind: address\n\n  # example: a nested array with an unknown element type\n  - kind: array\n    contains:\n      type:\n        kind: array\n        contains:\n          type:\n            class: elementary\n            kind: super-uint # unsupported type\n            blits: -256\n',
  "schema:ethdebug/format/type/complex/function": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/function"\n\ntitle: ethdebug/format/type/complex/function\ndescription: |\n  Schema for representing a function type.\n\n  Type representations must indicate whether they represent a function that is\n  called internally (within the semantics of the language) or a function that\n  is called externally (via EVM contract call semantics and the Solidity ABI).\n  Internal function types require the `"internal": true` field; external\n  function types require `"external": true`.\n\n  Note that external function types may include a representation of the\n  contract type that defines or provides this function as an external\n  interface.\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: function\n  contains:\n    type: object\n    title: Parameter and return types\n    description: |\n      Types this function type composes. Function types inherently compose\n      two groupings of types (an ordered list of parameter types and typically\n      either a return value or return parameters). Function types\' `contains`\n      field is organized as a mapping of `parameters` types (a type wrapper for\n      a tuple type) and an optional `returns` type (either a generic type\n      wrapper or a type wrapper for a tuple type).\n\n      This definition applies for both cases (internal and external function\n      types). Each of those specific types may expand this `contains` field\n      schema with other semantic details (such as an external function type\n      indicating the contract type from which it is exposed).\n    properties:\n      parameters:\n        $ref: "#/$defs/Parameters"\n      returns:\n        type: object\n        title: Return type (or tuple of types)\n        description: |\n          To accommodate languages differing in whether functions return single\n          values or lists of values, this field may be either a generic type\n          wrapper or explicitly defined as a type wrapper around a tuple type.\n\n          Debuggers that implement this schema **should** be aware that\n          languages whose functions return sole values might return tuple\n          types. Resolving this ambiguity remains outside the scope of the\n          schema (but compilers **must** be consistent when representing\n          function types in this schema).\n        anyOf:\n          - $ref: "schema:ethdebug/format/type/wrapper"\n          - $ref: "#/$defs/Parameters"\n    required:\n      - parameters\n  definition:\n    $ref: "schema:ethdebug/format/type/definition"\n\nrequired:\n  - kind\n  - contains\n\noneOf:\n  - type: object\n    title: External function type\n    properties:\n      internal:\n        const: false\n      external:\n        const: true\n      contains:\n        type: object\n        title: Additional contents\n        properties:\n          contract:\n            type: object\n            title: Contract type providing external function\n            description:\n              A wrapper around the contract type that composes this external\n              function type.\n            allOf:\n              - $ref: "schema:ethdebug/format/type/wrapper"\n              - type: object\n                title: Contract type wrapper\n                properties:\n                  type:\n                    oneOf:\n                      - $ref: "schema:ethdebug/format/type/elementary/contract"\n                      - $ref: "schema:ethdebug/format/type/reference"\n    required:\n      - external\n\n  - type: object\n    title: Internal function type\n    properties:\n      internal:\n        const: true\n      external:\n        const: false\n    required:\n      - internal\n\nexamples:\n  - kind: function\n    internal: true\n    definition:\n      name: increment\n    contains:\n      parameters:\n        type:\n          kind: tuple\n          contains:\n            - name: value\n              type:\n                kind: uint\n                bits: 256\n      returns:\n        type:\n          kind: uint\n          bits: 256\n  - kind: function\n    external: true\n    definition:\n      name: withdraw\n    contains:\n      contract:\n        type:\n          kind: contract\n          payable: true\n          interface: true\n          definition:\n            name: Bank\n      parameters:\n        type:\n          kind: tuple\n          contains:\n            - name: beneficiary\n              type:\n                kind: address\n                payable: true\n            - name: amount\n              type:\n                kind: ufixed\n                bits: 128\n                places: 18\n      returns:\n        type:\n          kind: tuple\n          contains: []\n\n$defs:\n  Parameters:\n    type: object\n    title: Parameters\n    description:\n      A type wrapper around a tuple of types. This schema uses a tuple type to\n      represent an ordered list of types.\n    allOf:\n      - $ref: "schema:ethdebug/format/type/wrapper"\n      - title: Tuple type wrapper\n        type: object\n        properties:\n          type:\n            oneOf:\n              - $ref: "schema:ethdebug/format/type/complex/tuple"\n              - $ref: "schema:ethdebug/format/type/reference"\n',
  "schema:ethdebug/format/type/complex/mapping": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/mapping"\n\ntitle: ethdebug/format/type/complex/mapping\ndescription: Schema for representing mapping types\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: mapping\n  contains:\n    type: object\n    title: Mapping key/value types\n    properties:\n      key:\n        $ref: "schema:ethdebug/format/type/wrapper"\n      value:\n        $ref: "schema:ethdebug/format/type/wrapper"\n    required:\n      - key\n      - value\n\nrequired:\n  - kind\n  - contains\n\nexamples:\n  - kind: mapping\n    contains:\n      key:\n        type:\n          kind: address\n      value:\n        type:\n          kind: uint\n          bits: 256\n',
  "schema:ethdebug/format/type/complex/struct": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/struct"\n\ntitle: ethdebug/format/type/complex/struct\ndescription: Schema for representing struct types\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: struct\n  contains:\n    type: array\n    items:\n      $ref: "#/$defs/MemberField"\n  definition:\n    $ref: "schema:ethdebug/format/type/definition"\n\nrequired:\n  - kind\n  - contains\n\nexamples:\n  - kind: struct\n    contains:\n      - name: x\n        type:\n          kind: uint\n          bits: 128\n      - name: y\n        type:\n          kind: uint\n          bits: 128\n\n$defs:\n  MemberField:\n    type: object\n    title: MemberField\n    description:\n      A schema representing a member field inside a struct type. This is an\n      **ethdebug/format/type/wrapper** with additional fields.\n    allOf:\n      - $ref: "schema:ethdebug/format/type/wrapper"\n      - title: Additional fields\n        description:\n          An object with optional `name` property for identifying named struct\n          member fields. **Note** that this language does not specify that a\n          struct must be consistent in its use of naming for all fields or none\n        type: object\n        properties:\n          name:\n            type: string\n',
  "schema:ethdebug/format/type/complex/tuple": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex/tuple"\n\ntitle: ethdebug/format/type/complex/tuple\ndescription: Schema for representing tuple types\n\ntype: object\nproperties:\n  class:\n    type: string\n    const: complex\n  kind:\n    type: string\n    const: tuple\n  contains:\n    type: array\n    items:\n      $ref: "#/$defs/Element"\n\nrequired:\n  - kind\n  - contains\n\nexamples:\n  - # empty tuple type\n    kind: tuple\n    contains: []\n\n  - kind: tuple\n    contains:\n      - name: x\n        type:\n          kind: uint\n          bits: 128\n      - name: y\n        type:\n          kind: uint\n          bits: 128\n\n$defs:\n  Element:\n    type: object\n    title: Element\n    description: An optionally named element type within a tuple. This is an\n      **ethdebug/format/type/wrapper** with additional fields.\n    allOf:\n      - $ref: "schema:ethdebug/format/type/wrapper"\n      - title: Additional fields\n        type: object\n        properties:\n          name:\n            type: string\n            description:\n              For tuple types where positional element types are identified\n              by name, this field **should** include this information.\n\n              This schema makes no restriction on whether all-or-no elements\n              have names, and so this field may be sparse across elements of\n              the same tuple.\n',
  "schema:ethdebug/format/type/complex": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/complex"\n\ntitle: ethdebug/format/type/complex\ndescription: Canonical representation of a complex type\n\ntype: object\nproperties:\n  kind:\n    $ref: "#/$defs/Kind"\nrequired:\n  - kind\n\nallOf:\n  - if:\n      properties:\n        kind:\n          const: alias\n    then:\n      $ref: "schema:ethdebug/format/type/complex/alias"\n\n  - if:\n      properties:\n        kind:\n          const: tuple\n    then:\n      $ref: "schema:ethdebug/format/type/complex/tuple"\n\n  - if:\n      properties:\n        kind:\n          const: array\n    then:\n      $ref: "schema:ethdebug/format/type/complex/array"\n\n  - if:\n      properties:\n        kind:\n          const: mapping\n    then:\n      $ref: "schema:ethdebug/format/type/complex/mapping"\n\n  - if:\n      properties:\n        kind:\n          const: struct\n    then:\n      $ref: "schema:ethdebug/format/type/complex/struct"\n\n  - if:\n      properties:\n        kind:\n          const: function\n    then:\n      $ref: "schema:ethdebug/format/type/complex/function"\n\n$defs:\n  Kind:\n    title: Known complex kind\n    description:\n      A schema for the values of `kind` reserved for known complex types\n      included in ethdebug/format\n    type: string\n    enum:\n      - alias\n      - tuple\n      - array\n      - mapping\n      - struct\n      - function\n',
  "schema:ethdebug/format/type/definition": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/definition"\n\ntitle: ethdebug/format/type/definition\ndescription: |\n  Object containing name and location information for a type.\n\n  This schema **must** specify at least one of `name` or `location`.\n\ntype: object\nproperties:\n  name:\n    type: string\n\n  location:\n    $ref: "schema:ethdebug/format/materials/source-range"\n\nanyOf:\n  - title: Required `name`\n    required: [name]\n  - title: Required `location`\n    required: [location]\n\nexamples:\n  - name: Ballot\n    location:\n      source:\n        id: 5\n      range:\n        offset: 10\n        length: 56\n',
  "schema:ethdebug/format/type/elementary/address": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/address"\n\ntitle: ethdebug/format/type/elementary/address\ndescription: Schema describing the representation of an address type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: address\n  payable:\n    type: boolean\n    description: If this field is omitted, this type represents an address whose\n      payability is not known.\nrequired:\n  - kind\nexamples:\n  - # a type for addresses of unknown payability\n    kind: address\n\n  - # a type for payable addresses\n    kind: address\n    payable: true\n',
  "schema:ethdebug/format/type/elementary/bool": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/bool"\n\ntitle: ethdebug/format/type/elementary/bool\ndescription: Schema describing the representation of the boolean type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: bool\nrequired:\n  - kind\nexamples:\n  - kind: bool\n',
  "schema:ethdebug/format/type/elementary/bytes": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/bytes"\n\ntitle: ethdebug/format/type/elementary/bytes\ndescription: Schema describing the representation of a type of bytes string\n  (either dynamic or static)\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: bytes\n  size:\n    description:\n      The number of bytes in the bytes string. If this field is omitted, this\n      type is the dynamic bytes string type.\n    $ref: "schema:ethdebug/format/data/unsigned"\nrequired:\n  - kind\nexamples:\n  - # example static bytes type\n    kind: bytes\n    size: 32\n  - # example dynamic bytes type\n    kind: bytes\n',
  "schema:ethdebug/format/type/elementary/contract": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/contract"\n\ntitle: ethdebug/format/type/elementary/contract\ndescription: Schema describing the representation of a contract type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: contract\n  payable:\n    type: boolean\n    description: If this field is omitted, this type represents an address whose\n      payability is not known.\n  library:\n    type: boolean\n  interface:\n    type: boolean\n  definition:\n    $ref: "schema:ethdebug/format/type/definition"\n\noneOf:\n  - title: Normal contract type\n    properties:\n      library:\n        const: false\n      interface:\n        const: false\n\n  - title: Contract library type\n    properties:\n      library:\n        const: true\n        description: Indicates that this is a type representing a library\n    required:\n      - library\n\n  - title: Contract interface type\n    properties:\n      interface:\n        const: true\n        description: Indicates that this is a type representing an interface\n    required:\n      - interface\n\nrequired:\n  - kind\n\nexamples:\n  - kind: contract\n\n  - kind: contract\n    library: false\n    interface: false\n    payable: true\n',
  "schema:ethdebug/format/type/elementary/enum": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/enum"\n\ntitle: ethdebug/format/type/elementary/enum\ndescription: Schema describing the representation of an enumerated type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: enum\n  values:\n    description:\n      The allowed values of an enum. This format makes no restriction on which\n      values are allowed here.\n    type: array\n    items: true\n  definition:\n    $ref: "schema:ethdebug/format/type/definition"\n\nrequired:\n  - kind\n  - values\n\nexamples:\n  - kind: enum\n    values:\n      - A\n      - B\n      - C\n',
  "schema:ethdebug/format/type/elementary/fixed": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/fixed"\n\ntitle: ethdebug/format/type/elementary/fixed\ndescription: Schema describing the representation of a signed fixed decimal type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: fixed\n  bits:\n    type: integer\n    multipleOf: 8\n    minimum: 8\n    maximum: 256\n  places:\n    type: integer\n    description:\n      How many decimal places, implying that a raw value `v` of this type\n      should be interpreted as `v / (10**places)`\n    minimum: 1\n    maximum: 80\nrequired:\n  - kind\n  - bits\n  - places\nexamples:\n  - kind: fixed\n    bits: 256\n    places: 10\n',
  "schema:ethdebug/format/type/elementary/int": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/int"\n\ntitle: ethdebug/format/type/elementary/int\ndescription: Schema describing the representation of a signed integer type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: int\n  bits:\n    type: integer\n    multipleOf: 8\n    minimum: 8\n    maximum: 256\nrequired:\n  - kind\n  - bits\nexamples:\n  - kind: int\n    bits: 256\n',
  "schema:ethdebug/format/type/elementary/string": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/elementary/string"

title: ethdebug/format/type/elementary/string
description: Schema describing the representation of a string type

type: object
properties:
  class:
    const: elementary
  kind:
    const: string
  encoding:
    description: |
      The character encoding of the string's bytes at runtime.
    $ref: "schema:ethdebug/format/materials/encoding"
    default: utf-8
required:
  - kind
examples:
  - kind: string
  - kind: string
    encoding: utf-16le
`,
  "schema:ethdebug/format/type/elementary/ufixed": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/ufixed"\n\ntitle: ethdebug/format/type/elementary/ufixed\ndescription: Schema describing the representation of an unsigned fixed decimal type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: ufixed\n  bits:\n    type: integer\n    multipleOf: 8\n    minimum: 8\n    maximum: 256\n  places:\n    type: integer\n    description:\n      How many decimal places, implying that a raw value `v` of this type\n      should be interpreted as `v / (10**places)`\n    minimum: 1\n    maximum: 80\nrequired:\n  - kind\n  - bits\n  - places\nexamples:\n  - kind: ufixed\n    bits: 256\n    places: 10\n',
  "schema:ethdebug/format/type/elementary/uint": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary/uint"\n\ntitle: ethdebug/format/type/elementary/uint\ndescription: Schema describing the representation of an unsigned integer type\n\ntype: object\nproperties:\n  class:\n    const: elementary\n  kind:\n    const: uint\n  bits:\n    type: integer\n    multipleOf: 8\n    minimum: 8\n    maximum: 256\nrequired:\n  - kind\n  - bits\nexamples:\n  - kind: uint\n    bits: 256\n',
  "schema:ethdebug/format/type/elementary": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/elementary"\n\ntitle: ethdebug/format/type/elementary\ndescription: Canonical representation of an elementary type\n\ntype: object\nproperties:\n  kind:\n    $ref: "#/$defs/Kind"\n  contains:\n    not:\n      description: "Elementary types **must not** specify a `contains` field\n        (to make it easier to discriminate elementary vs. complex)"\nrequired:\n  - kind\n\nallOf:\n  - if:\n      properties:\n        kind:\n          const: uint\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/uint"\n\n  - if:\n      properties:\n        kind:\n          const: int\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/int"\n\n  - if:\n      properties:\n        kind:\n          const: bool\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/bool"\n\n  - if:\n      properties:\n        kind:\n          const: bytes\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/bytes"\n\n  - if:\n      properties:\n        kind:\n          const: string\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/string"\n\n  - if:\n      properties:\n        kind:\n          const: ufixed\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/ufixed"\n\n  - if:\n      properties:\n        kind:\n          const: fixed\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/fixed"\n  - if:\n      properties:\n        kind:\n          const: address\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/address"\n\n  - if:\n      properties:\n        kind:\n          const: contract\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/contract"\n\n  - if:\n      properties:\n        kind:\n          const: enum\n    then:\n      $ref: "schema:ethdebug/format/type/elementary/enum"\n\n$defs:\n  Kind:\n    title: Known elementary kind\n    description:\n      A schema for the values of `kind` reserved for known elementary types\n      included in ethdebug/format\n    type: string\n    enum:\n      - uint\n      - int\n      - bool\n      - bytes\n      - string\n      - ufixed\n      - fixed\n      - address\n      - contract\n      - enum\n',
  "schema:ethdebug/format/type/reference": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/reference"\n\ntitle: ethdebug/format/type/reference\ndescription: A reference to a known type by ID\ntype: object\nproperties:\n  id:\n    type:\n      - string\n      - number\nadditionalProperties: false\nrequired:\n  - id\nexamples:\n  - id: 5\n',
  "schema:ethdebug/format/type/specifier": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type/specifier"\n\ntitle: ethdebug/format/type/specifier\ndescription: |\n  A type specifier: either a complete type representation or a\n  reference to a known type by ID. This schema discriminates\n  between the two forms based on the presence of an `id` field.\n\nif:\n  required: [id]\nthen:\n  $ref: "schema:ethdebug/format/type/reference"\nelse:\n  $ref: "schema:ethdebug/format/type"\n\nexamples:\n  - kind: uint\n    bits: 256\n  - id: 42\n',
  "schema:ethdebug/format/type/wrapper": `$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "schema:ethdebug/format/type/wrapper"

title: ethdebug/format/type/wrapper
description:
  A wrapper around a type. Defines a \`"type"\` field that may include a full
  Type representation or a reference to a known Type by ID. Note that this
  schema permits additional properties on the same object.
type: object
properties:
  type:
    $ref: "schema:ethdebug/format/type/specifier"

required:
  - type

examples:
  - name: beneficiary
    type:
      kind: address
      payable: true
  - type:
      id: "<opaque-id>"

$defs:
  Array:
    title: '{ "type": ... }[]'
    description: A list of wrapped types, where the wrapper may add fields
    type: array
    items:
      $ref: "schema:ethdebug/format/type/wrapper"

  Object:
    title: '{ "key": { "type": ... }, ... }'
    description: A key-value mapping of wrapped types, where the wrapper may add fields
    type: object
    additionalProperties:
      $ref: "schema:ethdebug/format/type/wrapper"
`,
  "schema:ethdebug/format/type": '$schema: "https://json-schema.org/draft/2020-12/schema"\n$id: "schema:ethdebug/format/type"\n\ntitle: ethdebug/format/type\ndescription: Canonical representation for all types.\ntype: object\n\nif:\n  type: object\n  title: Known kind\n  description: If `kind` adheres to the set of known kinds defined by this format\n  properties:\n    kind:\n      anyOf:\n        - $ref: "schema:ethdebug/format/type/elementary#/$defs/Kind"\n        - $ref: "schema:ethdebug/format/type/complex#/$defs/Kind"\n\nthen:\n  type: object\n  title: KnownType\n  description: Then the object must adhere to exactly one known kind of type\n  allOf:\n    - if:\n        properties:\n          kind:\n            $ref: "schema:ethdebug/format/type/elementary#/$defs/Kind"\n      then:\n        $ref: "schema:ethdebug/format/type/elementary"\n    - if:\n        properties:\n          kind:\n            $ref: "schema:ethdebug/format/type/complex#/$defs/Kind"\n      then:\n        $ref: "schema:ethdebug/format/type/complex"\n\nelse:\n  type: object\n  description:\n    Else the object must be a valid **ethdebug/format/type/base** with\n    additional constraints\n  allOf:\n    - $ref: "schema:ethdebug/format/type/base"\n    - title: Required `class` field\n      required:\n        - class\n    - title: Specialized complex type `contains` field\n      type: object\n      if:\n        description: If this object is a complex type\n        properties:\n          class:\n            const: complex\n      then:\n        description: Then the `contains` field must adhere to\n          **ethdebug/format/type/wrapper** schemas, not the\n          **ethdebug/format/type/base** equivalent.\n\n          (i.e., these additional constraints must apply recursively)\n        properties:\n          contains:\n            oneOf:\n              - $ref: "schema:ethdebug/format/type/wrapper"\n              - $ref: "schema:ethdebug/format/type/wrapper#/$defs/Array"\n              - $ref: "schema:ethdebug/format/type/wrapper#/$defs/Object"\n'
};

var parseOptions2 = {
  // merge keys were removed from YAML 1.2 spec but used by these schemas
  merge: true
};
function describeSchema({
  schema: schema4,
  pointer
}) {
  if (typeof pointer === "string" && !pointer.startsWith("#")) {
    throw new Error("`pointer` option must start with '#'");
  }
  const pointerOptions = pointer ? { pointer } : {};
  if (referencesId(schema4)) {
    return describeSchemaById({
      schema: typeof schema4 === "object" ? schema4 : { id: schema4 },
      ...pointerOptions
    });
  }
  if (referencesYaml(schema4)) {
    return describeSchemaByYaml({
      schema: schema4,
      ...pointerOptions
    });
  }
  return describeSchemaByObject({
    schema: schema4,
    ...pointerOptions
  });
}
function describeSchemaById({
  schema: { id: referencedId },
  pointer: relativePointer
}) {
  const [id, rawReferencedPointer] = referencedId.split("#");
  const pointer = rawReferencedPointer ? joinSchemaPointers([`#${rawReferencedPointer}`, relativePointer]) : relativePointer;
  const rootYaml = schemaYamls[id];
  if (!rootYaml) {
    throw new Error(`Unknown schema with $id "${id}"`);
  }
  const yaml = pointToYaml(rootYaml, pointer);
  const schema4 = parse(yaml, parseOptions2);
  const rootSchema = parse(rootYaml, parseOptions2);
  return {
    id,
    ...pointer ? { pointer } : {},
    yaml,
    schema: schema4,
    rootSchema
  };
}
function describeSchemaByYaml({
  schema: { yaml: referencedYaml },
  pointer
}) {
  const yaml = pointToYaml(referencedYaml, pointer);
  const schema4 = parse(yaml, parseOptions2);
  const rootSchema = parse(referencedYaml, parseOptions2);
  const id = schema4.$id;
  if (id) {
    return {
      id,
      ...pointer ? { pointer } : {},
      yaml,
      schema: schema4,
      rootSchema
    };
  } else {
    return {
      ...pointer ? { pointer } : {},
      yaml,
      schema: schema4,
      rootSchema
    };
  }
}
function describeSchemaByObject({
  schema: rootSchema,
  pointer
}) {
  const rootYaml = stringify3(rootSchema);
  const yaml = pointToYaml(rootYaml, pointer);
  const schema4 = parse(yaml, parseOptions2);
  const id = schema4.$id;
  if (id) {
    return {
      id,
      ...pointer ? { pointer } : {},
      yaml,
      schema: schema4,
      rootSchema
    };
  } else {
    return {
      ...pointer ? { pointer } : {},
      yaml,
      schema: schema4,
      rootSchema
    };
  }
}
function joinSchemaPointers(pointers) {
  const joined = pointers.filter((pointer) => typeof pointer === "string").map((pointer) => pointer.slice(1)).join("");
  if (joined.length === 0) {
    return;
  }
  return `#${joined}`;
}
function pointToYaml(yaml, pointer) {
  if (!pointer) {
    return yaml;
  }
  let doc = parseDocument(yaml);
  for (const step of pointer.slice(2).split("/")) {
    doc = doc.get(step, true);
    if (!doc) {
      throw new Error(`Pointer ${pointer} not found in schema`);
    }
  }
  return stringify3(doc);
}
function referencesId(schema4) {
  return typeof schema4 === "string" || Object.keys(schema4).length === 1 && "id" in schema4;
}
function referencesYaml(schema4) {
  return typeof schema4 === "object" && Object.keys(schema4).length === 1 && "yaml" in schema4;
}

var schemaIds = Object.keys(schemaYamls);
var schemas2 = schemaIds.map((id) => ({
  [id]: describeSchema({ schema: { id } }).schema
})).reduce((a, b) => ({ ...a, ...b }), {});

var version = "0.1.0-draft.1";

var Data;
((Data3) => {
  Data3.isValue = (value) => [Data3.isUnsigned, Data3.isHex].some((guard) => guard(value));
  Data3.isUnsigned = (value) => typeof value === "number" && value >= 0;
  const hexPattern = new RegExp(/^0x[0-9a-fA-F]{1,}$/);
  Data3.isHex = (value) => typeof value === "string" && hexPattern.test(value);
  Data3.stamp = (schema4, unstamped) => ({
    ethdebug: { schema: schema4, version },
    ...unstamped
  });
  Data3.versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
  Data3.isStamp = (value) => typeof value === "object" && !!value && "schema" in value && typeof value.schema === "string" && "version" in value && typeof value.version === "string" && Data3.versionPattern.test(value.version) && Object.keys(value).length === 2;
})(Data || (Data = {}));

var Materials;
((Materials2) => {
  Materials2.isId = (value) => ["number", "string"].includes(typeof value);
  Materials2.isReference = (value) => typeof value === "object" && !!value && "id" in value && (0, Materials2.isId)(value.id);
  function toReference(object) {
    return {
      id: object.id,
      ...[
        [Materials2.isCompilation, "compilation"],
        [Materials2.isSource, "source"]
      ].filter(([guard]) => guard(object)).map(([_, type]) => ({ type }))[0] || {}
    };
  }
  Materials2.toReference = toReference;
  Materials2.isCompilation = (value) => typeof value === "object" && !!value && "id" in value && (0, Materials2.isId)(value.id) && "compiler" in value && typeof value.compiler === "object" && !!value.compiler && "name" in value.compiler && typeof value.compiler.name === "string" && "version" in value.compiler && typeof value.compiler.version === "string" && "sources" in value && Array.isArray(value.sources) && value.sources.every(Materials2.isSource);
  Materials2.isSource = (value) => typeof value === "object" && !!value && "id" in value && (0, Materials2.isId)(value.id) && "path" in value && typeof value.path === "string" && "contents" in value && typeof value.contents === "string" && "language" in value && typeof value.language === "string" && (!("encoding" in value) || typeof value.encoding === "string");
  Materials2.isSourceRange = (value) => typeof value === "object" && !!value && "source" in value && (0, Materials2.isReference)(value.source) && (!("range" in value) || typeof value.range === "object" && !!value.range && "offset" in value.range && Data.isValue(value.range.offset) && "length" in value.range && Data.isValue(value.range.length)) && (!("compilation" in value) || (0, Materials2.isReference)(value.compilation));
})(Materials || (Materials = {}));

var base_exports = {};
__export(base_exports, {
  isComplex: () => isComplex,
  isElementary: () => isElementary,
  isType: () => isType,
  isWrapper: () => isWrapper
});
var isType = (value) => [isElementary, isComplex].some((guard) => guard(value));
var isElementary = (value) => typeof value === "object" && !!value && "kind" in value && typeof value.kind === "string" && (!("class" in value) || value.class === "elementary") && !("contains" in value);
var isComplex = (value) => typeof value === "object" && !!value && "kind" in value && typeof value.kind === "string" && (!("class" in value) || value.class === "complex") && "contains" in value && !!value.contains && (isWrapper(value.contains) || Array.isArray(value.contains) && value.contains.every(isWrapper) || typeof value.contains === "object" && Object.values(value.contains).every(isWrapper));
var isWrapper = (value) => typeof value === "object" && !!value && "type" in value && (isType(value.type) || typeof value.type === "object" && !!value.type && "id" in value.type);

var isType2 = (value) => Type.hasElementaryKind(value) || Type.hasComplexKind(value) ? Type.isKnown(value) : Type.isUnknown(value);
var Type;
((Type2) => {
  Type2.Base = base_exports;
  Type2.isKnown = (value) => [Type2.isElementary, Type2.isComplex].some((guard) => guard(value));
  Type2.isUnknown = (value) => Type2.Base.isType(value) && "class" in value && (!("contains" in value) || Type2.isWrapper(value.contains) || Array.isArray(value.contains) && value.contains.every(Type2.isWrapper) || typeof value.contains === "object" && Object.values(value.contains).every(Type2.isWrapper));
  Type2.isReference = (value) => typeof value === "object" && !!value && "id" in value && (typeof value.id === "string" || typeof value.id === "number");
  Type2.isSpecifier = (value) => isType2(value) || (0, Type2.isReference)(value);
  Type2.isWrapper = (value) => typeof value === "object" && !!value && "type" in value && (0, Type2.isSpecifier)(value.type);
  Type2.hasElementaryKind = (value) => typeof value === "object" && !!value && "kind" in value && typeof value.kind === "string" && [
    "uint",
    "int",
    "ufixed",
    "fixed",
    "bool",
    "bytes",
    "string",
    "address",
    "contract",
    "enum"
  ].includes(value.kind);
  Type2.isElementary = (value) => [
    Elementary.isUint,
    Elementary.isInt,
    Elementary.isUfixed,
    Elementary.isFixed,
    Elementary.isBool,
    Elementary.isBytes,
    Elementary.isString,
    Elementary.isAddress,
    Elementary.isContract,
    Elementary.isEnum
  ].some((guard) => guard(value));
  let Elementary;
  ((Elementary2) => {
    Elementary2.isUint = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "uint") && "bits" in value && typeof value.bits === "number" && value.bits >= 8 && value.bits <= 256 && value.bits % 8 === 0;
    Elementary2.isInt = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "int") && "bits" in value && typeof value.bits === "number" && value.bits >= 8 && value.bits <= 256 && value.bits % 8 === 0;
    Elementary2.isUfixed = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "ufixed") && "bits" in value && typeof value.bits === "number" && value.bits >= 8 && value.bits <= 256 && value.bits % 8 === 0 && "places" in value && typeof value.places === "number" && value.places >= 1 && value.places <= 80;
    Elementary2.isFixed = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "fixed") && "bits" in value && typeof value.bits === "number" && value.bits >= 8 && value.bits <= 256 && value.bits % 8 === 0 && "places" in value && typeof value.places === "number" && value.places >= 1 && value.places <= 80;
    Elementary2.isBool = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "bool");
    Elementary2.isBytes = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "bytes") && (!("size" in value) || Data.isUnsigned(value.size));
    Elementary2.isString = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "string") && (!("encoding" in value) || typeof value.encoding === "string");
    Elementary2.isAddress = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "address") && (!("payable" in value) || typeof value.payable === "boolean");
    Elementary2.isContract = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "contract") && (!("payable" in value) || typeof value.payable === "boolean") && (!("library" in value) || typeof value.library === "boolean") && (!("interface" in value) || typeof value.interface === "boolean") && // The schema's oneOf splits contract types three ways (normal /
    // library / interface). `library` and `interface` cannot both be
    // true: that shape satisfies two branches at once, which the
    // oneOf rejects.
    !("library" in value && value.library === true && "interface" in value && value.interface === true) && (!("definition" in value) || (0, Type2.isDefinition)(value.definition));
    Elementary2.isEnum = (value) => typeof value === "object" && !!value && mayHaveClass(value, "elementary") && hasKind(value, "enum") && "values" in value && Array.isArray(value.values) && (!("definition" in value) || (0, Type2.isDefinition)(value.definition));
  })(Elementary = Type2.Elementary || (Type2.Elementary = {}));
  Type2.hasComplexKind = (value) => typeof value === "object" && !!value && "kind" in value && typeof value.kind === "string" && [
    "alias",
    "tuple",
    "array",
    "mapping",
    "struct"
    // "function"
  ].includes(value.kind);
  Type2.isComplex = (value) => [
    Complex.isAlias,
    Complex.isTuple,
    Complex.isArray,
    Complex.isMapping,
    Complex.isStruct
  ].some((guard) => guard(value));
  let Complex;
  ((Complex2) => {
    Complex2.isAlias = (value) => typeof value === "object" && !!value && mayHaveClass(value, "complex") && hasKind(value, "alias") && "contains" in value && (0, Type2.isWrapper)(value.contains) && (!("definition" in value) || (0, Type2.isDefinition)(value.definition));
    Complex2.isTuple = (value) => typeof value === "object" && !!value && mayHaveClass(value, "complex") && hasKind(value, "tuple") && "contains" in value && Array.isArray(value.contains) && value.contains.every(
      (element) => (0, Type2.isWrapper)(element) && (!("name" in element) || typeof element.name === "string")
    );
    Complex2.isArray = (value) => typeof value === "object" && !!value && mayHaveClass(value, "complex") && hasKind(value, "array") && "contains" in value && (0, Type2.isWrapper)(value.contains);
    Complex2.isMapping = (value) => typeof value === "object" && !!value && mayHaveClass(value, "complex") && hasKind(value, "mapping") && "contains" in value && typeof value.contains === "object" && !!value.contains && "key" in value.contains && (0, Type2.isWrapper)(value.contains.key) && "value" in value.contains && (0, Type2.isWrapper)(value.contains.value);
    Complex2.isStruct = (value) => typeof value === "object" && !!value && mayHaveClass(value, "complex") && hasKind(value, "struct") && "contains" in value && Array.isArray(value.contains) && value.contains.every(
      (field) => (0, Type2.isWrapper)(field) && (!("name" in field) || typeof field.name === "string")
    ) && (!("definition" in value) || (0, Type2.isDefinition)(value.definition));
  })(Complex = Type2.Complex || (Type2.Complex = {}));
  Type2.isDefinition = (value) => typeof value === "object" && !!value && (!("name" in value) || typeof value.name === "string") && (!("location" in value) || Materials.isSourceRange(value.location)) && (Object.keys(value).includes("name") || Object.keys(value).includes("location"));
})(Type || (Type = {}));
var mayHaveClass = (object, class_) => !("class" in object) || object.class === class_;
var hasKind = (object, kind) => "kind" in object && object.kind === kind;

var isPointer = (value) => [Pointer.isRegion, Pointer.isCollection].some((guard) => guard(value));
var Pointer;
((Pointer3) => {
  Pointer3.isIdentifier = (value) => typeof value === "string" && /^[a-zA-Z_-]+[a-zA-Z0-9$_-]*$/.test(value);
  Pointer3.isRegion = (value) => [
    Region.isStack,
    Region.isMemory,
    Region.isStorage,
    Region.isCalldata,
    Region.isReturndata,
    Region.isTransient,
    Region.isCode
  ].some((guard) => guard(value));
  let Region;
  ((Region2) => {
    Region2.isBase = (value) => !!value && typeof value === "object" && (!("name" in value) || typeof value.name === "string") && "location" in value && typeof value.location === "string";
    Region2.isStack = (value) => (0, Region2.isBase)(value) && Scheme.isSegment(value) && value.location === "stack";
    Region2.isMemory = (value) => (0, Region2.isBase)(value) && Scheme.isSlice(value) && value.location === "memory";
    Region2.isStorage = (value) => (0, Region2.isBase)(value) && Scheme.isSegment(value) && value.location === "storage";
    Region2.isCalldata = (value) => (0, Region2.isBase)(value) && Scheme.isSlice(value) && value.location === "calldata";
    Region2.isReturndata = (value) => (0, Region2.isBase)(value) && Scheme.isSlice(value) && value.location === "returndata";
    Region2.isTransient = (value) => (0, Region2.isBase)(value) && Scheme.isSegment(value) && value.location === "transient";
    Region2.isCode = (value) => (0, Region2.isBase)(value) && Scheme.isSlice(value) && value.location === "code";
  })(Region = Pointer3.Region || (Pointer3.Region = {}));
  let Scheme;
  ((Scheme2) => {
    Scheme2.isSegment = (value) => !!value && typeof value === "object" && "slot" in value && (0, Pointer3.isExpression)(value.slot) && (!("offset" in value) || (0, Pointer3.isExpression)(value.offset)) && (!("length" in value) || (0, Pointer3.isExpression)(value.length));
    Scheme2.isSlice = (value) => !!value && typeof value === "object" && "offset" in value && (0, Pointer3.isExpression)(value.offset) && "length" in value && (0, Pointer3.isExpression)(value.length);
  })(Scheme = Pointer3.Scheme || (Pointer3.Scheme = {}));
  Pointer3.isCollection = (value) => [
    Collection2.isGroup,
    Collection2.isList,
    Collection2.isConditional,
    Collection2.isScope,
    Collection2.isReference,
    Collection2.isTemplates
  ].some((guard) => guard(value));
  let Collection2;
  ((Collection3) => {
    Collection3.isGroup = (value) => !!value && typeof value === "object" && Object.keys(value).length === 1 && "group" in value && Array.isArray(value.group) && value.group.length >= 1 && value.group.every(isPointer);
    Collection3.isList = (value) => !!value && typeof value === "object" && Object.keys(value).length === 1 && "list" in value && !!value.list && typeof value.list === "object" && Object.keys(value.list).length === 3 && "count" in value.list && (0, Pointer3.isExpression)(value.list.count) && "each" in value.list && (0, Pointer3.isIdentifier)(value.list.each) && "is" in value.list && isPointer(value.list.is);
    Collection3.isConditional = (value) => !!value && typeof value === "object" && "if" in value && (0, Pointer3.isExpression)(value.if) && "then" in value && isPointer(value.then) && (!("else" in value) || isPointer(value.else));
    Collection3.isScope = (value) => !!value && typeof value === "object" && "define" in value && typeof value.define === "object" && !!value.define && Object.keys(value.define).every((key) => (0, Pointer3.isIdentifier)(key)) && "in" in value && isPointer(value.in);
    Collection3.isReference = (value) => !!value && typeof value === "object" && "template" in value && typeof value.template === "string" && !!value.template && (!("yields" in value) || typeof value.yields === "object" && value.yields !== null && Object.entries(value.yields).every(
      ([k, v]) => (0, Pointer3.isIdentifier)(k) && (0, Pointer3.isIdentifier)(v)
    ));
    Collection3.isTemplates = (value) => !!value && typeof value === "object" && "templates" in value && typeof value.templates === "object" && !!value.templates && Object.keys(value.templates).every(Pointer3.isIdentifier) && Object.values(value.templates).every(Pointer3.isTemplate) && "in" in value && isPointer(value.in);
  })(Collection2 = Pointer3.Collection || (Pointer3.Collection = {}));
  Pointer3.isExpression = (value) => [
    Expression.isLiteral,
    Expression.isConstant,
    Expression.isVariable,
    Expression.isArithmetic,
    Expression.isLookup,
    Expression.isRead,
    Expression.isKeccak256,
    Expression.isConcat,
    Expression.isResize
  ].some((guard) => guard(value));
  let Expression;
  ((Expression2) => {
    Expression2.isLiteral = (value) => typeof value === "number" || typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
    Expression2.isConstant = (value) => typeof value === "string" && ["$wordsize"].includes(value);
    Expression2.isVariable = (value) => (0, Pointer3.isIdentifier)(value);
    Expression2.isArithmetic = (value) => [
      Arithmetic.isSum,
      Arithmetic.isDifference,
      Arithmetic.isProduct,
      Arithmetic.isQuotient,
      Arithmetic.isRemainder
    ].some((guard) => guard(value));
    const makeIsOperation = (operation, checkOperands) => (value) => !!value && typeof value === "object" && Object.keys(value).length === 1 && operation in value && checkOperands(value[operation]);
    Expression2.isOperands = (value) => Array.isArray(value) && value.every(Pointer3.isExpression);
    let Arithmetic;
    ((Arithmetic2) => {
      Arithmetic2.isTwoOperands = (value) => (0, Expression2.isOperands)(value) && value.length === 2;
      Arithmetic2.isSum = makeIsOperation("$sum", Expression2.isOperands);
      Arithmetic2.isDifference = makeIsOperation(
        "$difference",
        Arithmetic2.isTwoOperands
      );
      Arithmetic2.isProduct = makeIsOperation(
        "$product",
        Expression2.isOperands
      );
      Arithmetic2.isQuotient = makeIsOperation(
        "$quotient",
        Arithmetic2.isTwoOperands
      );
      Arithmetic2.isRemainder = makeIsOperation(
        "$remainder",
        Arithmetic2.isTwoOperands
      );
    })(Arithmetic = Expression2.Arithmetic || (Expression2.Arithmetic = {}));
    Expression2.isReference = (value) => (0, Pointer3.isIdentifier)(value) || value === "$this";
    Expression2.isLookup = (value) => [Lookup.isOffset, Lookup.isLength, Lookup.isSlot].some(
      (guard) => guard(value)
    );
    let Lookup;
    ((Lookup2) => {
      Lookup2.propertyFrom = (operation) => {
        return operation.slice(1);
      };
      Lookup2.isOffset = makeIsOperation(
        ".offset",
        Expression2.isReference
      );
      Lookup2.isLength = makeIsOperation(
        ".length",
        Expression2.isReference
      );
      Lookup2.isSlot = makeIsOperation(
        ".slot",
        Expression2.isReference
      );
    })(Lookup = Expression2.Lookup || (Expression2.Lookup = {}));
    Expression2.isRead = makeIsOperation("$read", Expression2.isReference);
    Expression2.isKeccak256 = makeIsOperation(
      "$keccak256",
      Expression2.isOperands
    );
    Expression2.isConcat = makeIsOperation(
      "$concat",
      Expression2.isOperands
    );
    Expression2.isResize = (value) => [Resize.isToWordsize, Resize.isToNumber].some((guard) => guard(value));
    let Resize;
    ((Resize2) => {
      Resize2.isToNumber = (value) => {
        if (!value || typeof value !== "object" || Object.keys(value).length !== 1) {
          return false;
        }
        const [key] = Object.keys(value);
        return typeof key === "string" && /^\$sized([1-9]+[0-9]*)$/.test(key);
      };
      Resize2.isToWordsize = (value) => !!value && typeof value === "object" && Object.keys(value).length === 1 && "$wordsized" in value && typeof value.$wordsized !== "undefined" && (0, Pointer3.isExpression)(value.$wordsized);
    })(Resize = Expression2.Resize || (Expression2.Resize = {}));
  })(Expression = Pointer3.Expression || (Pointer3.Expression = {}));
  Pointer3.isTemplates = (value) => !!value && typeof value === "object" && Object.keys(value).every(Pointer3.isIdentifier) && Object.values(value).every(Pointer3.isTemplate);
  Pointer3.isTemplate = (value) => !!value && typeof value === "object" && Object.keys(value).length === 2 && "expect" in value && Array.isArray(value.expect) && value.expect.every(Pointer3.isIdentifier) && "for" in value && isPointer(value.for);
})(Pointer || (Pointer = {}));

var isContext = (value) => [
  Context.isName,
  Context.isCode,
  Context.isVariables,
  Context.isRemark,
  Context.isPick,
  Context.isFrame,
  Context.isGather,
  Context.isInvoke,
  Context.isReturn,
  Context.isRevert,
  Context.isTransform
].some((guard) => guard(value));
var Context;
((Context3) => {
  Context3.isName = (value) => typeof value === "object" && !!value && "name" in value && typeof value.name === "string";
  Context3.isCode = (value) => typeof value === "object" && !!value && "code" in value && Materials.isSourceRange(value.code);
  Context3.isVariables = (value) => typeof value === "object" && !!value && "variables" in value && Array.isArray(value.variables) && value.variables.length > 0 && value.variables.every(Variables.isVariable);
  let Variables;
  ((Variables2) => {
    const allowedKeys = /* @__PURE__ */ new Set([
      "identifier",
      "declaration",
      "type",
      "pointer"
    ]);
    Variables2.isVariable = (value) => typeof value === "object" && !!value && Object.keys(value).length > 0 && Object.keys(value).every((key) => allowedKeys.has(key)) && (!("identifier" in value) || typeof value.identifier === "string") && (!("declaration" in value) || Materials.isSourceRange(value.declaration)) && (!("type" in value) || Type.isSpecifier(value.type)) && (!("pointer" in value) || isPointer(value.pointer));
  })(Variables = Context3.Variables || (Context3.Variables = {}));
  Context3.isRemark = (value) => typeof value === "object" && !!value && "remark" in value && typeof value.remark === "string";
  Context3.isPick = (value) => typeof value === "object" && !!value && "pick" in value && Array.isArray(value.pick) && value.pick.every(isContext);
  Context3.isGather = (value) => typeof value === "object" && !!value && "gather" in value && Array.isArray(value.gather) && value.gather.every(isContext);
  Context3.isFrame = (value) => typeof value === "object" && !!value && "frame" in value && typeof value.frame === "string";
  let Function;
  ((Function2) => {
    Function2.isIdentity = (value) => typeof value === "object" && !!value && (!("identifier" in value) || typeof value.identifier === "string") && (!("declaration" in value) || Materials.isSourceRange(value.declaration)) && (!("type" in value) || Type.isSpecifier(value.type));
    Function2.isPointerRef = (value) => typeof value === "object" && !!value && "pointer" in value && isPointer(value.pointer);
  })(Function = Context3.Function || (Context3.Function = {}));
  Context3.isInvoke = (value) => typeof value === "object" && !!value && "invoke" in value && Invoke.isInvocation(value.invoke);
  let Invoke;
  ((Invoke2) => {
    Invoke2.isInvocation = (value) => Function.isIdentity(value) && (!("activation" in value) || typeof value.activation === "string") && (Invocation.isInternalCall(value) || Invocation.isExternalCall(value) || Invocation.isContractCreation(value));
    let Invocation;
    ((Invocation2) => {
      Invocation2.isInternalCall = (value) => typeof value === "object" && !!value && "jump" in value && value.jump === true && (!("target" in value) || Function.isPointerRef(value.target)) && (!("arguments" in value) || Function.isPointerRef(value.arguments));
      Invocation2.isExternalCall = (value) => typeof value === "object" && !!value && "message" in value && value.message === true && "target" in value && Function.isPointerRef(value.target) && (!("gas" in value) || Function.isPointerRef(value.gas)) && (!("value" in value) || Function.isPointerRef(value.value)) && (!("input" in value) || Function.isPointerRef(value.input)) && (!("delegate" in value) || value.delegate === true) && (!("static" in value) || value.static === true);
      Invocation2.isContractCreation = (value) => typeof value === "object" && !!value && "create" in value && value.create === true && (!("value" in value) || Function.isPointerRef(value.value)) && (!("salt" in value) || Function.isPointerRef(value.salt)) && (!("input" in value) || Function.isPointerRef(value.input));
    })(Invocation = Invoke2.Invocation || (Invoke2.Invocation = {}));
  })(Invoke = Context3.Invoke || (Context3.Invoke = {}));
  Context3.isReturn = (value) => typeof value === "object" && !!value && "return" in value && Return.isInfo(value.return);
  let Return;
  ((Return2) => {
    Return2.isInfo = (value) => Function.isIdentity(value) && typeof value === "object" && !!value && (!("data" in value) || Function.isPointerRef(value.data)) && (!("success" in value) || Function.isPointerRef(value.success)) && (!("activation" in value) || typeof value.activation === "string");
  })(Return = Context3.Return || (Context3.Return = {}));
  Context3.isRevert = (value) => typeof value === "object" && !!value && "revert" in value && Revert.isInfo(value.revert);
  let Revert;
  ((Revert2) => {
    Revert2.isInfo = (value) => Function.isIdentity(value) && typeof value === "object" && !!value && (!("reason" in value) || Function.isPointerRef(value.reason)) && (!("panic" in value) || typeof value.panic === "number") && (!("activation" in value) || typeof value.activation === "string");
  })(Revert = Context3.Revert || (Context3.Revert = {}));
  Context3.isTransform = (value) => typeof value === "object" && !!value && "transform" in value && Array.isArray(value.transform) && value.transform.length > 0 && value.transform.every(
    (item) => typeof item === "string" && item.length > 0
  );
})(Context || (Context = {}));

var isInstruction = (value) => typeof value === "object" && !!value && "offset" in value && Data.isValue(value.offset) && (!("context" in value) || isContext(value.context)) && (!("operation" in value) || Instruction.isOperation(value.operation));
var Instruction;
((Instruction2) => {
  Instruction2.isOperation = (value) => typeof value === "object" && !!value && "mnemonic" in value && typeof value.mnemonic === "string" && (!("arguments" in value) || Array.isArray(value.arguments) && value.arguments.every(Data.isValue));
})(Instruction || (Instruction = {}));

var Program;
((Program2) => {
  Program2.Context = Context;
  Program2.isContext = isContext;
  Program2.Instruction = Instruction;
  Program2.isInstruction = isInstruction;
  Program2.isEnvironment = (value) => typeof value === "string" && ["call", "create"].includes(value);
  Program2.isContract = (value) => typeof value === "object" && !!value && "definition" in value && Materials.isSourceRange(value.definition) && (!("name" in value) || typeof value.name === "string");
})(Program || (Program = {}));

function number(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`positive integer expected, not ${n}`);
}
function bool(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function isBytes(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
function bytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
}
function hash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number(h.outputLen);
  number(h.blockLen);
}
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
var assert = { number, bool, bytes, hash, exists, output };
var assert_default = assert;

var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
var byteSwap = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
}
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes2) {
  bytes(bytes2);
  let hex = "";
  for (let i = 0; i < bytes2.length; i++) {
    hex += hexes[bytes2[i]];
  }
  return hex;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  bytes(data);
  return data;
}
var Hash = class {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
var toStr = {}.toString;
function wrapConstructor(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function wrapXOFConstructorWithOpts(hashCons) {
  const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  return hashC;
}

var assertBool = assert_default.bool;
var assertBytes = assert_default.bytes;
function wrapHash(hash2) {
  return (msg) => {
    assert_default.bytes(msg);
    return hash2(msg);
  };
}
var crypto = (() => {
  const webCrypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  const nodeRequire = typeof module !== "undefined" && typeof module.require === "function" && module.require.bind(module);
  return {
    node: nodeRequire && !webCrypto ? nodeRequire("crypto") : void 0,
    web: webCrypto
  };
})();

var customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");
var Data2 = class _Data extends Uint8Array {
  static zero() {
    return new _Data([]);
  }
  static fromUint(value) {
    if (value === 0n) {
      return this.zero();
    }
    const byteCount = Math.ceil(Number(value.toString(2).length) / 8);
    const bytes2 = new Uint8Array(byteCount);
    for (let i = byteCount - 1; i >= 0; i--) {
      bytes2[i] = Number(value & 0xffn);
      value >>= 8n;
    }
    return new _Data(bytes2);
  }
  static fromNumber(value) {
    const byteCount = Math.ceil(Math.log2(value + 1) / 8);
    const bytes2 = new Uint8Array(byteCount);
    for (let i = byteCount - 1; i >= 0; i--) {
      bytes2[i] = value & 255;
      value >>= 8;
    }
    return new _Data(bytes2);
  }
  static fromHex(hex) {
    if (!hex.startsWith("0x")) {
      throw new Error('Invalid hex string format. Expected "0x" prefix.');
    }
    const bytes2 = new Uint8Array((hex.length - 2) / 2 + 0.5);
    for (let i = 2; i < hex.length; i += 2) {
      bytes2[i / 2 - 1] = parseInt(hex.slice(i, i + 2), 16);
    }
    return new _Data(bytes2);
  }
  static fromBytes(bytes2) {
    return new _Data(bytes2);
  }
  asUint() {
    const bits = 8n;
    let value = 0n;
    for (const byte of this.values()) {
      const byteValue = BigInt(byte);
      value = (value << bits) + byteValue;
    }
    return value;
  }
  toHex() {
    return `0x${bytesToHex(this)}`;
  }
  padUntilAtLeast(length) {
    if (this.length >= length) {
      return this;
    }
    const padded = new Uint8Array(length);
    padded.set(this, length - this.length);
    return _Data.fromBytes(padded);
  }
  resizeTo(length) {
    if (this.length === length) {
      return this;
    }
    const resized = new Uint8Array(length);
    if (this.length < length) {
      resized.set(this, length - this.length);
    } else {
      resized.set(this.slice(this.length - length));
    }
    return _Data.fromBytes(resized);
  }
  concat(...others) {
    const concatenatedHex = [this, ...others].map((data) => data.toHex().slice(2)).reduce((accumulator, hex) => `${accumulator}${hex}`, "0x");
    return _Data.fromHex(concatenatedHex);
  }
  inspect(_depth, options, _inspect) {
    return `Data[${options.stylize(this.toHex(), "number")}]`;
  }
  [customInspectSymbol](depth, options, inspect) {
    return this.inspect(depth, options, inspect);
  }
};

async function read(region, options) {
  const { location } = region;
  const { state } = options;
  switch (location) {
    case "stack": {
      const { slot, offset, length } = withPropertiesAsUints(
        ["slot", "offset", "length"],
        region
      );
      return await readSegment(
        { offset, length },
        (carry, slice) => state.stack.peek({ depth: slot + carry, slice })
      );
    }
    case "memory": {
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await state.memory.read({
        slice: {
          offset,
          length
        }
      });
    }
    case "storage": {
      const { slot } = region;
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await readSegment(
        { offset, length },
        (carry, slice) => state.storage.read({ slot: slotAfter(slot, carry), slice })
      );
    }
    case "calldata": {
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await state.calldata.read({ slice: { offset, length } });
    }
    case "returndata": {
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await state.returndata.read({ slice: { offset, length } });
    }
    case "transient": {
      const { slot } = region;
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await readSegment(
        { offset, length },
        (carry, slice) => state.transient.read({ slot: slotAfter(slot, carry), slice })
      );
    }
    case "code": {
      const { offset, length } = withPropertiesAsUints(
        ["offset", "length"],
        region
      );
      return await state.code.read({ slice: { offset, length } });
    }
  }
}
var wordsize = 32n;
async function readSegment({ offset = 0n, length }, readWord) {
  const startCarry = offset / wordsize;
  const startByte = offset % wordsize;
  const totalLength = length ?? wordsize - startByte;
  if (totalLength === 0n) {
    return Data2.zero();
  }
  const endByte = startByte + totalLength;
  const wordCount = (endByte + wordsize - 1n) / wordsize;
  const words = [];
  for (let index = 0n; index < wordCount; index++) {
    const from = index === 0n ? startByte : 0n;
    const to = index === wordCount - 1n ? endByte - index * wordsize : wordsize;
    words.push(
      await readWord(startCarry + index, {
        offset: from,
        length: to - from
      })
    );
  }
  return Data2.zero().concat(...words);
}
function slotAfter(slot, carry) {
  if (carry === 0n) {
    return slot;
  }
  return Data2.fromUint(slot.asUint() + carry).padUntilAtLeast(slot.length);
}
function withPropertiesAsUints(uintKeys, region) {
  const result = {};
  for (const key of uintKeys) {
    const data = region[key];
    if (typeof data !== "undefined") {
      result[key] = data.asUint();
    }
  }
  return result;
}

var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _7n = /* @__PURE__ */ BigInt(7);
var _256n = /* @__PURE__ */ BigInt(256);
var _0x71n = /* @__PURE__ */ BigInt(113);
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var [SHA3_IOTA_H, SHA3_IOTA_L] = /* @__PURE__ */ split(_SHA3_IOTA, true);
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  B.fill(0);
}
var Keccak = class _Keccak extends Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    number(outputLen);
    if (0 >= this.blockLen || this.blockLen >= 200)
      throw new Error("Sha3 supports only keccak-f1600 function");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  keccak() {
    if (!isLE)
      byteSwap32(this.state32);
    keccakP(this.state32, this.rounds);
    if (!isLE)
      byteSwap32(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    exists(this);
    const { blockLen, state } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    exists(this, false);
    bytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes2) {
    number(bytes2);
    return this.xofInto(new Uint8Array(bytes2));
  }
  digestInto(out) {
    output(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    this.state.fill(0);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var gen = (suffix, blockLen, outputLen) => wrapConstructor(() => new Keccak(blockLen, suffix, outputLen));
var sha3_224 = /* @__PURE__ */ gen(6, 144, 224 / 8);
var sha3_256 = /* @__PURE__ */ gen(6, 136, 256 / 8);
var sha3_384 = /* @__PURE__ */ gen(6, 104, 384 / 8);
var sha3_512 = /* @__PURE__ */ gen(6, 72, 512 / 8);
var keccak_224 = /* @__PURE__ */ gen(1, 144, 224 / 8);
var keccak_256 = /* @__PURE__ */ gen(1, 136, 256 / 8);
var keccak_384 = /* @__PURE__ */ gen(1, 104, 384 / 8);
var keccak_512 = /* @__PURE__ */ gen(1, 72, 512 / 8);
var genShake = (suffix, blockLen, outputLen) => wrapXOFConstructorWithOpts((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true));
var shake128 = /* @__PURE__ */ genShake(31, 168, 128 / 8);
var shake256 = /* @__PURE__ */ genShake(31, 136, 256 / 8);

var keccak224 = wrapHash(keccak_224);
var keccak256 = (() => {
  const k = wrapHash(keccak_256);
  k.create = keccak_256.create;
  return k;
})();
var keccak384 = wrapHash(keccak_384);
var keccak512 = wrapHash(keccak_512);

var Value;
((Value2) => {
  Value2.integer = (value) => ({
    sort: "integer",
    value
  });
  Value2.bytes = (data) => ({ sort: "bytes", data });
  Value2.isInteger = (value) => value.sort === "integer";
  Value2.isBytes = (value) => value.sort === "bytes";
  Value2.toInteger = (value) => (0, Value2.isInteger)(value) ? value.value : value.data.asUint();
  Value2.toData = (value) => (0, Value2.isBytes)(value) ? value.data : Data2.fromUint(value.value);
})(Value || (Value = {}));
async function evaluate(expression, options) {
  if (Pointer.Expression.isLiteral(expression)) {
    return evaluateLiteral(expression);
  }
  if (Pointer.Expression.isConstant(expression)) {
    return evaluateConstant(expression);
  }
  if (Pointer.Expression.isVariable(expression)) {
    return evaluateVariable(expression, options);
  }
  if (Pointer.Expression.isArithmetic(expression)) {
    return evaluateArithmetic(expression, options);
  }
  if (Pointer.Expression.isKeccak256(expression)) {
    return evaluateKeccak256(expression, options);
  }
  if (Pointer.Expression.isConcat(expression)) {
    return evaluateConcat(expression, options);
  }
  if (Pointer.Expression.isResize(expression)) {
    return evaluateResize(expression, options);
  }
  if (Pointer.Expression.isLookup(expression)) {
    if (Pointer.Expression.Lookup.isOffset(expression)) {
      return evaluateLookup(".offset", expression, options);
    }
    if (Pointer.Expression.Lookup.isLength(expression)) {
      return evaluateLookup(".length", expression, options);
    }
    if (Pointer.Expression.Lookup.isSlot(expression)) {
      return evaluateLookup(".slot", expression, options);
    }
  }
  if (Pointer.Expression.isRead(expression)) {
    return evaluateRead(expression, options);
  }
  throw new Error(
    `Unexpected runtime failure to recognize kind of expression: ${JSON.stringify(
      expression
    )}`
  );
}
async function evaluateInteger(expression, options) {
  return Value.toInteger(await evaluate(expression, options));
}
async function evaluateBytesOperands(operation, operands, options) {
  return await Promise.all(
    operands.map(async (operand, index) => {
      const value = await evaluate(operand, options);
      if (Value.isInteger(value)) {
        throw new Error(
          [
            `Operand ${index} of ${operation} (${JSON.stringify(operand)}) `,
            `evaluates to the integer ${value.value}, which has no byte `,
            `width; give it a width with $wordsized or $sizedN`
          ].join("")
        );
      }
      return value.data;
    })
  );
}
async function evaluateLiteral(literal) {
  switch (typeof literal) {
    case "string": {
      const digits = literal.slice(2);
      if (digits.length % 2 === 1) {
        return Value.integer(BigInt(literal));
      }
      return Value.bytes(Data2.fromHex(literal));
    }
    case "number":
      return Value.integer(BigInt(literal));
  }
}
async function evaluateConstant(constant) {
  switch (constant) {
    case "$wordsize":
      return Value.integer(32n);
  }
}
async function evaluateVariable(identifier, { variables }) {
  const value = variables[identifier];
  if (typeof value === "undefined") {
    throw new Error(`Unknown variable with identifier ${identifier}`);
  }
  return value;
}
async function evaluateArithmetic(expression, options) {
  const [[operation, operandExpressions]] = Object.entries(expression);
  const operands = await Promise.all(
    operandExpressions.map((operand) => evaluateInteger(operand, options))
  );
  switch (operation) {
    case "$sum":
      return Value.integer(operands.reduce((sum, value) => sum + value, 0n));
    case "$difference": {
      const [a, b] = operands;
      return Value.integer(a > b ? a - b : 0n);
    }
    case "$product":
      return Value.integer(
        operands.reduce((product, value) => product * value, 1n)
      );
    case "$quotient": {
      const [a, b] = operands;
      return Value.integer(a / b);
    }
    case "$remainder": {
      const [a, b] = operands;
      return Value.integer(a % b);
    }
  }
  throw new Error(`Unknown arithmetic operation ${operation}`);
}
async function evaluateKeccak256(expression, options) {
  const operands = await evaluateBytesOperands(
    "$keccak256",
    expression.$keccak256,
    options
  );
  const preimage = Data2.zero().concat(...operands);
  return Value.bytes(Data2.fromBytes(keccak256(preimage)));
}
async function evaluateConcat(expression, options) {
  const operands = await evaluateBytesOperands(
    "$concat",
    expression.$concat,
    options
  );
  return Value.bytes(Data2.zero().concat(...operands));
}
async function evaluateResize(expression, options) {
  const [[operation, subexpression]] = Object.entries(expression);
  const newLength = Pointer.Expression.Resize.isToNumber(expression) ? Number(operation.match(/^\$sized([1-9]+[0-9]*)$/)[1]) : 32;
  const value = await evaluate(subexpression, options);
  return Value.bytes(Value.toData(value).resizeTo(newLength));
}
async function evaluateLookup(operation, lookup, options) {
  const { regions } = options;
  const identifier = lookup[operation];
  const region = regions[identifier];
  if (!region) {
    throw new Error(`Region not found: ${identifier}`);
  }
  const property = Pointer.Expression.Lookup.propertyFrom(operation);
  const data = region[property];
  if (typeof data === "undefined") {
    throw new Error(
      `Region named ${identifier} does not have ${property} needed by lookup`
    );
  }
  return Value.integer(data.asUint());
}
async function evaluateRead(expression, options) {
  const { state: _state, regions } = options;
  const identifier = expression.$read;
  const region = regions[identifier];
  if (!region) {
    throw new Error(`Region not found: ${identifier}`);
  }
  return Value.bytes(await read(region, options));
}

async function evaluateRegion(region, options) {
  const evaluatedProperties = {};
  const propertyAttempts = {};
  const partialRegion = new Proxy(
    { ...region },
    {
      get(_target, property) {
        if (property in evaluatedProperties) {
          return evaluatedProperties[property];
        }
        throw new Error(
          `Property not evaluated yet: $this.${property.toString()}`
        );
      }
    }
  );
  const propertiesRequiringEvaluation = ["slot", "offset", "length"];
  const expressionQueue = propertiesRequiringEvaluation.filter((property) => property in region).map((property) => [property, region[property]]);
  while (expressionQueue.length > 0) {
    const [property, expression] = expressionQueue.shift();
    try {
      const value = await evaluate(expression, {
        ...options,
        regions: {
          ...options.regions,
          $this: partialRegion
        }
      });
      evaluatedProperties[property] = Value.toData(value);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Property not evaluated yet: $this.")) {
        const attempts = propertyAttempts[property] || 0;
        if (attempts > propertiesRequiringEvaluation.length - 1) {
          throw new Error(
            `Circular reference detected: $this.${property.toString()}`
          );
        }
        propertyAttempts[property] = attempts + 1;
        expressionQueue.push([property, expression]);
      } else {
        throw error;
      }
    }
  }
  return {
    ...region,
    ...evaluatedProperties
  };
}
function adjustStackLength(region, stackLengthChange) {
  if (Pointer.Region.isStack(region)) {
    const slot = stackLengthChange === 0n ? region.slot : stackLengthChange > 0n ? { $sum: [region.slot, `0x${stackLengthChange.toString(16)}`] } : {
      $difference: [
        region.slot,
        `0x${-stackLengthChange.toString(16)}`
      ]
    };
    return {
      ...region,
      slot
    };
  }
  return region;
}

async function* processPointer(pointer, options) {
  if (Pointer.isRegion(pointer)) {
    const region = pointer;
    return yield* processRegion(region, options);
  }
  const collection = pointer;
  if (Pointer.Collection.isGroup(collection)) {
    return yield* processGroup(collection, options);
  }
  if (Pointer.Collection.isList(collection)) {
    return yield* processList(collection, options);
  }
  if (Pointer.Collection.isConditional(collection)) {
    return yield* processConditional(collection, options);
  }
  if (Pointer.Collection.isScope(collection)) {
    return yield* processScope(collection, options);
  }
  if (Pointer.Collection.isReference(collection)) {
    return yield* processReference(collection, options);
  }
  if (Pointer.Collection.isTemplates(collection)) {
    return yield* processTemplates(collection, options);
  }
  console.error("%s", JSON.stringify(pointer, void 0, 2));
  throw new Error("Unexpected unknown kind of pointer");
}
async function* processRegion(region, { stackLengthChange, ...options }) {
  const evaluatedRegion = await evaluateRegion(
    adjustStackLength(region, stackLengthChange),
    options
  );
  yield evaluatedRegion;
  if (typeof region.name !== "undefined") {
    return [Memo.saveRegions({ [region.name]: evaluatedRegion })];
  }
  return [];
}
async function* processGroup(collection, _options) {
  const { group } = collection;
  return group.map(Memo.dereferencePointer);
}
async function* processList(collection, options) {
  const { list } = collection;
  const { count: countExpression, each, is } = list;
  const count = Value.toInteger(await evaluate(countExpression, options));
  const memos = [];
  for (let index = 0n; index < count; index++) {
    memos.push(
      Memo.saveVariables({
        [each]: Value.integer(index)
      })
    );
    memos.push(Memo.dereferencePointer(is));
  }
  return memos;
}
async function* processConditional(collection, options) {
  const { if: ifExpression, then: then_, else: else_ } = collection;
  const if_ = Value.toInteger(await evaluate(ifExpression, options));
  if (if_) {
    return [Memo.dereferencePointer(then_)];
  }
  return else_ ? [Memo.dereferencePointer(else_)] : [];
}
async function* processScope(collection, options) {
  const { define: variableExpressions, in: in_ } = collection;
  const allVariables = Object.assign(
    /* @__PURE__ */ Object.create(null),
    options.variables
  );
  const newVariables = {};
  for (const [identifier, expression] of Object.entries(variableExpressions)) {
    const value = await evaluate(expression, {
      ...options,
      variables: allVariables
    });
    allVariables[identifier] = value;
    newVariables[identifier] = value;
  }
  return [
    Memo.saveVariables(newVariables),
    Memo.dereferencePointer(in_),
    Memo.restoreVariables(
      Object.assign(/* @__PURE__ */ Object.create(null), options.variables)
    )
  ];
}
async function* processReference(collection, options) {
  const { template: templateName, yields } = collection;
  const { templates, variables } = options;
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Unknown pointer template named ${templateName}`);
  }
  const { expect: expectedVariables, for: pointer } = template;
  const definedVariables = new Set(Object.keys(variables));
  const missingVariables = expectedVariables.filter(
    (identifier) => !definedVariables.has(identifier)
  );
  if (missingVariables.length > 0) {
    throw new Error(
      [
        `Invalid reference to template named ${templateName}; missing expected `,
        `variables with identifiers: ${missingVariables.join(", ")}. `,
        `Please ensure these variables are defined prior to this reference.`
      ].join("")
    );
  }
  if (yields && Object.keys(yields).length > 0) {
    return [
      Memo.pushRegionRenames(yields),
      Memo.dereferencePointer(pointer),
      Memo.popRegionRenames()
    ];
  }
  return [Memo.dereferencePointer(pointer)];
}
async function* processTemplates(collection, _options) {
  const { templates, in: in_ } = collection;
  return [
    Memo.pushTemplates(templates),
    Memo.dereferencePointer(in_),
    Memo.popTemplates()
  ];
}

async function* generateRegions(pointer, generateRegionsOptions) {
  const options = await initializeProcessOptions(generateRegionsOptions);
  const { regions, variables } = options;
  const renameStack = [];
  const templatesStack = [];
  const stack = [Memo.dereferencePointer(pointer)];
  while (stack.length > 0) {
    const memo = stack.pop();
    let memos = [];
    switch (memo.kind) {
      case "dereference-pointer": {
        const currentTemplates = templatesStack.reduce(
          (acc, templates) => ({ ...acc, ...templates }),
          options.templates
        );
        const process = processPointer(memo.pointer, {
          ...options,
          templates: currentTemplates
        });
        let result = await process.next();
        while (!result.done) {
          let region = result.value;
          if (region.name) {
            const name = renameStack.reduceRight(
              (name2, mapping) => hasOwn(mapping, name2) ? mapping[name2] : name2,
              region.name
            );
            if (name !== region.name) {
              region = { ...region, name };
            }
          }
          yield region;
          result = await process.next();
        }
        memos = result.value;
        break;
      }
      case "save-regions": {
        for (const [name, region] of Object.entries(memo.regions)) {
          regions[name] = region;
        }
        break;
      }
      case "save-variables": {
        Object.assign(variables, memo.variables);
        break;
      }
      case "restore-variables": {
        for (const name of Object.keys(variables)) {
          delete variables[name];
        }
        Object.assign(variables, memo.variables);
        break;
      }
      case "push-region-renames": {
        renameStack.push(memo.mapping);
        break;
      }
      case "pop-region-renames": {
        const mapping = renameStack.pop();
        if (mapping) {
          for (const [originalName, newName] of Object.entries(mapping)) {
            if (originalName in regions && newName !== originalName) {
              regions[newName] = { ...regions[originalName], name: newName };
            }
          }
        }
        break;
      }
      case "push-templates": {
        templatesStack.push(memo.templates);
        break;
      }
      case "pop-templates": {
        templatesStack.pop();
        break;
      }
    }
    for (let index = memos.length - 1; index >= 0; index--) {
      stack.push(memos[index]);
    }
  }
}
var hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
async function initializeProcessOptions({
  templates,
  state,
  initialStackLength
}) {
  const currentStackLength = await state.stack.length;
  const stackLengthChange = currentStackLength - initialStackLength;
  const regions = /* @__PURE__ */ Object.create(null);
  const variables = /* @__PURE__ */ Object.create(null);
  return {
    templates,
    state,
    stackLengthChange,
    regions,
    variables
  };
}

function createCursor(simpleCursor) {
  return {
    async view(state) {
      const list = [];
      for await (const region of simpleCursor(state)) {
        list.push(region);
      }
      const named = /* @__PURE__ */ Object.create(null);
      const current = /* @__PURE__ */ Object.create(null);
      const propertyFlags = {
        writable: false,
        enumerable: false,
        configurable: false
      };
      const regions = Object.create(Array.prototype, {
        length: {
          value: list.length,
          ...propertyFlags
        }
      });
      for (const [index, region] of list.entries()) {
        Object.defineProperty(regions, index, {
          value: region,
          ...propertyFlags,
          enumerable: true
        });
        if (typeof region.name === "string") {
          if (!(region.name in named)) {
            named[region.name] = [];
          }
          named[region.name].push(region);
          current[region.name] = region;
        }
      }
      Object.defineProperties(regions, {
        named: {
          value: (name) => name in named ? named[name] : [],
          ...propertyFlags
        },
        lookup: {
          value: current,
          ...propertyFlags
        }
      });
      for (const [name, region] of Object.entries(current)) {
        if (name in regions) {
          continue;
        }
        Object.defineProperty(regions, name, {
          value: region,
          ...propertyFlags
        });
      }
      return {
        regions,
        async read(region) {
          return await read(region, { state });
        }
      };
    }
  };
}

async function dereference(pointer, dereferenceOptions = {}) {
  const options = await initializeGenerateRegionsOptions(dereferenceOptions);
  const simpleCursor = (state) => ({
    async *[Symbol.asyncIterator]() {
      yield* generateRegions(pointer, { ...options, state });
    }
  });
  return createCursor(simpleCursor);
}
async function initializeGenerateRegionsOptions({
  templates = {},
  state: initialState
}) {
  const initialStackLength = initialState ? await initialState.stack.length : 0n;
  return {
    templates,
    initialStackLength
  };
}

function createMachineState(executor, options = {}) {
  const { traceStep, traceIndex = 0n } = options;
  const programCounter = options.programCounter ?? (traceStep ? BigInt(traceStep.pc) : 0n);
  const opcode = options.opcode ?? (traceStep ? traceStep.opcode : "STOP");
  return {
    traceIndex: Promise.resolve(traceIndex),
    programCounter: Promise.resolve(programCounter),
    opcode: Promise.resolve(opcode),
    stack: {
      length: Promise.resolve(traceStep ? BigInt(traceStep.stack.length) : 0n),
      async peek({ depth, slice }) {
        if (!traceStep) {
          return Data2.zero();
        }
        const { stack } = traceStep;
        const index = stack.length - 1 - Number(depth);
        if (index < 0 || index >= stack.length) {
          return Data2.zero();
        }
        const data = Data2.fromUint(stack[index]).padUntilAtLeast(32);
        if (slice) {
          const sliced = new Uint8Array(data).slice(Number(slice.offset), Number(slice.offset + slice.length));
          return Data2.fromBytes(sliced);
        }
        return data;
      }
    },
    memory: {
      length: Promise.resolve(traceStep?.memory ? BigInt(traceStep.memory.length) : 0n),
      async read({ slice }) {
        if (!traceStep?.memory) {
          return Data2.zero();
        }
        const sliced = traceStep.memory.slice(Number(slice.offset), Number(slice.offset + slice.length));
        return Data2.fromBytes(sliced);
      }
    },
    storage: {
      async read({ slot, slice }) {
        const slotValue = slot.asUint();
        const value = await executor.getStorage(slotValue);
        const data = Data2.fromUint(value);
        if (slice) {
          const padded = data.padUntilAtLeast(32);
          const sliced = new Uint8Array(padded).slice(Number(slice.offset), Number(slice.offset + slice.length));
          return Data2.fromBytes(sliced);
        }
        return data.padUntilAtLeast(32);
      }
    },
    calldata: {
      length: Promise.resolve(0n),
      read: async () => Data2.zero()
    },
    returndata: {
      length: Promise.resolve(0n),
      read: async () => Data2.zero()
    },
    code: {
      length: (async () => {
        const code = await executor.getCode();
        return BigInt(code.length);
      })(),
      async read({ slice }) {
        const code = await executor.getCode();
        const sliced = code.slice(Number(slice.offset), Number(slice.offset + slice.length));
        return Data2.fromBytes(sliced);
      }
    },
    transient: {
      read: async () => Data2.zero()
    }
  };
}

function effectiveContextForStep({ programContext, contextAtPc, trace, stepIndex }) {
  if (stepIndex <= 0) {
    return programContext;
  }
  const previous = trace[stepIndex - 1];
  if (!previous) {
    return programContext;
  }
  return contextAtPc(previous.pc);
}

function extractVariablesFromInstruction(instruction) {
  if (!instruction.context) {
    return [];
  }
  const joined = [];
  for (const listed of listedIn(instruction.context)) {
    const same2 = joined.find((other) => sameVariable(other, listed));
    if (same2) {
      same2.entry = { ...same2.entry, ...listed.entry };
    } else {
      joined.push({ ...listed });
    }
  }
  return joined.map(({ entry }) => entry);
}
function listedIn(context, frame) {
  const ctx = context;
  const here = typeof ctx.frame === "string" ? ctx.frame : frame;
  const own = Array.isArray(ctx.variables) ? ctx.variables.map((entry) => ({
    entry,
    frame: here
  })) : [];
  const gathered = Array.isArray(ctx.gather) ? ctx.gather.flatMap((c) => listedIn(c, here)) : [];
  const picked = [];
  if (Array.isArray(ctx.pick) && ctx.pick.length > 0) {
    const [first, ...others] = ctx.pick.map((c) => listedIn(c, here));
    for (const listed of first) {
      const matches = others.map((branch) => branch.find((other) => sameVariable(listed, other) && same(listed.entry.pointer, other.entry.pointer)));
      if (matches.some((match) => match === void 0))
        continue;
      const { type, ...rest } = listed.entry;
      const typed = matches.every((match) => same(type, match.entry.type));
      picked.push({ ...listed, entry: typed ? listed.entry : rest });
    }
  }
  return [...own, ...gathered, ...picked];
}
function sameVariable(a, b) {
  const x = a.entry.declaration;
  const y = b.entry.declaration;
  return a.frame === b.frame && a.entry.identifier === b.entry.identifier && x !== void 0 && y !== void 0 && x.source?.id === y.source?.id && x.range?.offset === y.range?.offset && x.range?.length === y.range?.length;
}
function same(a, b) {
  if (a === b)
    return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => same(a[key], b[key]));
}
function extractTransformFromInstruction(instruction) {
  if (!instruction.context) {
    return [];
  }
  return extractTransformFromContext(instruction.context);
}
function extractTransformFromContext(context) {
  if (Program.Context.isTransform(context)) {
    return context.transform;
  }
  const ctx = context;
  if ("gather" in ctx && Array.isArray(ctx.gather)) {
    return ctx.gather.flatMap(extractTransformFromContext);
  }
  if ("pick" in ctx && Array.isArray(ctx.pick)) {
    return ctx.pick.flatMap(extractTransformFromContext);
  }
  return [];
}
function extractCallEventsFromContext(context) {
  const events = collectCallInfos(context);
  if (events.length === 0) {
    return [];
  }
  const transforms = extractTransformFromContext(context);
  const isTailCall = transforms.includes("tailcall");
  const isInline = transforms.includes("inline");
  if (!isTailCall && !isInline) {
    return events;
  }
  return events.map((e) => ({
    ...e,
    ...isTailCall ? { isTailCall: true } : {},
    ...isInline ? { isInline: true } : {}
  }));
}
function collectCallInfos(context) {
  const ctx = context;
  const out = [];
  if ("invoke" in ctx) {
    out.push(parseInvoke(ctx.invoke));
  }
  if ("return" in ctx) {
    out.push(parseReturn(ctx.return));
  }
  if ("revert" in ctx) {
    out.push(parseRevert(ctx.revert));
  }
  if (Array.isArray(ctx.gather)) {
    for (const sub of ctx.gather) {
      out.push(...collectCallInfos(sub));
    }
  }
  if (Array.isArray(ctx.pick)) {
    for (const sub of ctx.pick) {
      out.push(...collectCallInfos(sub));
    }
  }
  return out;
}
function parseInvoke(inv) {
  const pointerRefs = [];
  let callType;
  if ("jump" in inv) {
    callType = "internal";
    collectPointerRef(pointerRefs, "target", inv.target);
    collectPointerRef(pointerRefs, "arguments", inv.arguments);
  } else if ("message" in inv) {
    callType = "external";
    collectPointerRef(pointerRefs, "target", inv.target);
    collectPointerRef(pointerRefs, "gas", inv.gas);
    collectPointerRef(pointerRefs, "value", inv.value);
    collectPointerRef(pointerRefs, "input", inv.input);
  } else if ("create" in inv) {
    callType = "create";
    collectPointerRef(pointerRefs, "value", inv.value);
    collectPointerRef(pointerRefs, "salt", inv.salt);
    collectPointerRef(pointerRefs, "input", inv.input);
  }
  return {
    kind: "invoke",
    identifier: inv.identifier,
    callType,
    argumentNames: extractArgNamesFromInvoke(inv),
    pointerRefs
  };
}
function parseReturn(ret) {
  const pointerRefs = [];
  collectPointerRef(pointerRefs, "data", ret.data);
  collectPointerRef(pointerRefs, "success", ret.success);
  return {
    kind: "return",
    identifier: ret.identifier,
    pointerRefs
  };
}
function parseRevert(rev) {
  const pointerRefs = [];
  collectPointerRef(pointerRefs, "reason", rev.reason);
  return {
    kind: "revert",
    identifier: rev.identifier,
    panic: rev.panic,
    pointerRefs
  };
}
function extractArgNamesFromInvoke(inv) {
  const args = inv.arguments;
  if (!args)
    return void 0;
  const pointer = args.pointer;
  if (!pointer)
    return void 0;
  const group = pointer.group;
  if (!Array.isArray(group))
    return void 0;
  const names = [];
  let hasAny = false;
  for (const entry of group) {
    const name = entry.name;
    if (name) {
      names.push(name);
      hasAny = true;
    } else {
      names.push("_");
    }
  }
  return hasAny ? names : void 0;
}
function collectPointerRef(refs, label, value) {
  if (value && typeof value === "object" && "pointer" in value) {
    refs.push({ label, pointer: value.pointer });
  }
}
function buildCallStack(trace, pcToInstruction, upToStep, programContext) {
  const stack = [];
  const contextAtPc = (pc) => pcToInstruction.get(pc)?.context;
  for (let i = 0; i <= upToStep && i < trace.length; i++) {
    const context = effectiveContextForStep({
      programContext,
      contextAtPc,
      trace,
      stepIndex: i
    });
    const ctx = context;
    const transforms = context ? extractTransformFromContext(context) : [];
    const inlineCount = transforms.filter((t) => t === "inline").length;
    const backEdgeInvoke = ctx ? findInvokeField(ctx) : void 0;
    if (ctx && backEdgeInvoke && hasReturnContext(ctx) && !transforms.includes("inline")) {
      const argResult = extractArgInfo(ctx);
      const frame = {
        identifier: backEdgeInvoke.identifier,
        stepIndex: i,
        callType: invokeCallType(backEdgeInvoke),
        argumentNames: argResult?.names,
        argumentPointers: argResult?.pointers,
        isTailCall: transforms.includes("tailcall")
      };
      if (stack.length > 0) {
        stack[stack.length - 1] = frame;
      } else {
        stack.push(frame);
      }
      continue;
    }
    const events = context ? extractCallEventsFromContext(context) : [];
    for (const event of events) {
      if (event.kind === "invoke") {
        const top = stack[stack.length - 1];
        const isDuplicate = top && top.identifier === event.identifier && top.callType === event.callType && top.stepIndex === i - 1 && !!top.isInline === !!event.isInline;
        if (isDuplicate) {
          const argResult = ctx ? extractArgInfo(ctx) : void 0;
          top.stepIndex = i;
          top.argumentNames = argResult?.names ?? top.argumentNames;
          top.argumentPointers = argResult?.pointers;
        } else {
          const argResult = ctx ? extractArgInfo(ctx) : void 0;
          stack.push({
            identifier: event.identifier,
            stepIndex: i,
            callType: event.callType,
            argumentNames: argResult?.names,
            argumentPointers: argResult?.pointers,
            // Tag virtual activations so the widget can render
            // them distinctly from real calls.
            ...event.isInline ? { isInline: true } : {}
          });
        }
      } else if (event.kind === "return" || event.kind === "revert") {
        if (stack.length > 0) {
          stack.pop();
        }
      }
    }
    let trailingVirtual = 0;
    for (let k = stack.length - 1; k >= 0 && stack[k].isInline; k--) {
      trailingVirtual++;
    }
    while (trailingVirtual > inlineCount && stack.length > 0 && stack[stack.length - 1].isInline) {
      stack.pop();
      trailingVirtual--;
    }
  }
  return stack;
}
function extractArgInfo(ctx) {
  const invoke = findInvokeField(ctx);
  if (!invoke)
    return void 0;
  const args = invoke.arguments;
  if (!args)
    return void 0;
  const pointer = args.pointer;
  if (!pointer)
    return void 0;
  const group = pointer.group;
  if (!Array.isArray(group))
    return void 0;
  const names = [];
  const pointers = [];
  let hasAnyName = false;
  for (const entry of group) {
    const name = entry.name;
    if (name) {
      names.push(name);
      hasAnyName = true;
    } else {
      names.push("_");
    }
    pointers.push(entry);
  }
  return {
    names: hasAnyName ? names : void 0,
    pointers
  };
}
function invokeCallType(inv) {
  if ("jump" in inv)
    return "internal";
  if ("message" in inv)
    return "external";
  if ("create" in inv)
    return "create";
  return void 0;
}
function hasReturnContext(ctx) {
  if ("return" in ctx) {
    return true;
  }
  if ("gather" in ctx && Array.isArray(ctx.gather)) {
    return ctx.gather.some((item) => item && typeof item === "object" && "return" in item);
  }
  return false;
}
function findInvokeField(ctx) {
  if ("invoke" in ctx) {
    return ctx.invoke;
  }
  if ("gather" in ctx && Array.isArray(ctx.gather)) {
    for (const item of ctx.gather) {
      if (item && typeof item === "object" && "invoke" in item) {
        return item.invoke;
      }
    }
  }
  return void 0;
}
function buildPcToInstructionMap(program) {
  const map2 = /* @__PURE__ */ new Map();
  for (const instr of program.instructions || []) {
    const offset = typeof instr.offset === "string" ? parseInt(instr.offset, 16) : instr.offset;
    map2.set(offset, instr);
  }
  return map2;
}

var commit = "1d45fea4c49b849c10399f55436843f33fdad4f0";
export {
  Data2 as Data,
  buildCallStack,
  buildPcToInstructionMap,
  commit,
  createMachineState,
  dereference,
  effectiveContextForStep,
  extractTransformFromInstruction,
  extractVariablesFromInstruction
};
