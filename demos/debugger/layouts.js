// Layout options for review, chosen with ?layout=a|b|c. The inline
// script in index.html sets data-layout on <html>; without it, nothing
// here runs and the page keeps its own layout. Each option moves the
// page's own elements into a few boxes, and layouts.css places the
// boxes. Display only: the viewer finds its elements by id and class,
// wherever they are.
const layout = document.documentElement.dataset.layout;
const q = (s) => document.querySelector(s);
const all = (s) => [...document.querySelectorAll(s)];
const div = (cls, ...kids) => {
  const d = document.createElement("div");
  d.className = cls;
  d.append(...kids);
  return d;
};

if (layout) {
  const stepper = q("#stepper");
  // The head: the data set (tab, and BUG's level), then its engine.
  const tabs = q(".tabs");
  const pick = div("dbg-pick");
  tabs.before(div("dbg-head", pick, ...all("p.engine")));
  pick.append(tabs, q(".levels"));
  // About each tab: below the debugger, so that the debugger keeps its
  // place when the tab changes.
  const [sol, fe, bug, feAdapts] = all(".about");
  stepper.after(div("dbg-about", q(".claim"), sol, fe, bug,
    ...all(".step-note"), feAdapts));
  // The debugger: controls, source, panels.
  const where = q("#where");
  const range = q("#stepper input[type=range]");
  const bar = div("bar", q(".ctl"), q(".skip"), q(".keys"));
  const view = div("view", q(".src"), div("foot", q(".gen-note"),
    q("#msg")));
  // A: the step line and slider head the source. B, C: in the bar.
  if (layout === "a") view.prepend(div("view-head", where, range));
  else bar.append(where, range);
  const panels = div("panels", ...all("#stepper .panel"));
  stepper.replaceChildren(...layout === "c" ? [view, bar, panels]
    : [bar, view, panels]);
}
