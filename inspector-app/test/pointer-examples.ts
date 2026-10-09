// Every pointer example in the ethdebug/format schemas (the pinned
// package's: the `examples:` of each pointer schema), made walkable:
// a region, a collection or a whole pointer as it is; an expression as
// a storage slot's; a scheme's partial region in its location; a
// template behind a reference to it; the names it uses but does not
// define (variables, regions) defined before it, as zeros. One that
// cannot be made a pointer is listed with the reason.
import { schemas } from "../src/engine/lib";

export interface Example {
  where: string;        // "pointer/collection/list #0"
  form: string;         // the construct it shows: "list", "~keccak256", …
  location: string;     // its regions' locations, or "-"
  pointer?: unknown;    // walkable; else `skip`
  skip?: string;
}

type Any = any;

// the variables and region names a pointer uses, and those it defines
function names(p: Any, out = { vars: new Set<string>(),
  regions: new Set<string>(), definedVars: new Set<string>(),
  definedRegions: new Set<string>(), templates: new Set<string>() }) {
  const expr = (e: Any) => {
    if (typeof e === "string") {
      if (e === "~wordsize" || /^0x/i.test(e) || /^\d+$/.test(e)) return;
      out.vars.add(e);
    } else if (Array.isArray(e)) e.forEach(expr);
    else if (e && typeof e === "object") {
      for (const [op, a] of Object.entries(e)) {
        if (op === "~read" || /^\.(slot|offset|length)$/.test(op)) {
          if (typeof a === "string" && a !== "~this") out.regions.add(a);
        } else expr(a);
      }
    }
  };
  const go = (q: Any) => {
    if (!q || typeof q !== "object") return;
    if ("location" in q) {
      if (q.name) out.definedRegions.add(q.name);
      for (const k of ["slot", "offset", "length"]) if (k in q) expr(q[k]);
    } else if ("group" in q) q.group.forEach(go);
    else if ("list" in q) {
      expr(q.list.count);
      out.definedVars.add(q.list.each);
      go(q.list.is);
    } else if ("if" in q) {
      expr(q.if);
      go(q.then);
      go(q.else);
    } else if ("define" in q) {
      for (const [k, e] of Object.entries(q.define)) {
        expr(e);
        out.definedVars.add(k);
      }
      go(q.in);
    } else if ("templates" in q) {
      for (const [k, t] of Object.entries(q.templates as Any)) {
        out.templates.add(k);
        go((t as Any).for);
      }
      go(q.in);
    } else if ("template" in q) {
      if (q.yields) {
        Object.values(q.yields).forEach((r) =>
          out.definedRegions.add(r as string));
      }
    }
  };
  go(p);
  return out;
}
const locations = (p: Any): string[] => {
  const out = new Set<string>();
  const go = (q: Any) => {
    if (!q || typeof q !== "object") return;
    if (typeof q.location === "string") out.add(q.location);
    Object.values(q).forEach(go);
  };
  go(p);
  return [...out].sort();
};
const formOf = (p: Any, where: string): string => {
  const m = where.match(/^pointer\/(collection|region|scheme)\/(\w+)/);
  if (m) return m[2];
  if (where.startsWith("pointer/template")) return "template";
  if (p && typeof p === "object") {
    const k = Object.keys(p)[0];
    if (k?.startsWith("~") || k?.startsWith(".")) return k;
    if ("location" in p) return "region";
    return k ?? "?";
  }
  return typeof p === "number" || /^0x/.test(p) ? "literal" : "variable";
};

// wrap a pointer with zeros for what it uses and does not define
function closed(p: Any): Any {
  const n = names(p);
  const vars = [...n.vars].filter((v) => !n.definedVars.has(v));
  const regions = [...n.regions].filter((r) => !n.definedRegions.has(r));
  let q = p;
  if (regions.length) {
    q = { group: [...regions.map((name) => ({ name, location: "memory",
      offset: 0, length: 32 })), q] };
  }
  if (vars.length) {
    q = { define: Object.fromEntries(vars.map((v) => [v, 0])), in: q };
  }
  return q;
}

export function pointerExamples(): Example[] {
  const out: Example[] = [];
  for (const [id, s] of Object.entries(schemas as Record<string, Any>)) {
    if (!id.startsWith("schema:ethdebug/format/pointer")) continue;
    const visit = (o: Any, where: string) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o.examples)) {
        o.examples.forEach((e: Any, k: number) => {
          const w = `${where} #${k}`;
          const form = formOf(e, where);
          if (where.startsWith("pointer/identifier")) {
            out.push({ where: w, form: "identifier", location: "-",
              skip: "an identifier, not a pointer" });
            return;
          }
          let p: Any;
          if (where.startsWith("pointer/region/base")) {
            out.push({ where: w, form, location: locations(e).join(","),
              skip: "the base every region extends: no location's own " +
                "fields (the library takes no region without them)" });
            return;
          }
          if (where.startsWith("pointer/expression")) {
            // (a slot's, in a region whose other fields `~this` can look
            // up)
            p = { location: "storage", slot: e, offset: 0, length: 32 };
          } else if (where.startsWith("pointer/scheme/segment")) {
            p = { location: "storage", ...e };
          } else if (where.startsWith("pointer/scheme/slice")) {
            p = { location: "memory", ...e };
          } else if (where.startsWith("pointer/template")) {
            p = { templates: { example: e }, in: { template: "example" } };
          } else p = e;
          const n = names(p);
          const missing = [...new Set(JSON.stringify(p).match(
            /"template":"([^"]+)"/g) ?? [])].map((x) => x.slice(12, -1))
            .filter((t) => !n.templates.has(t));
          if (missing.length) {
            out.push({ where: w, form, location: locations(p).join(",") ||
              "-", skip: `references a template no example defines (${
              missing.join(", ")})` });
            return;
          }
          out.push({ where: w, form, location: locations(p).join(",") || "-",
            pointer: closed(p) });
        });
      }
      for (const [k, v] of Object.entries(o)) {
        if (k !== "examples") visit(v, `${where}/${k}`);
      }
    };
    visit(s, id.replace("schema:ethdebug/format/", ""));
  }
  return out;
}
