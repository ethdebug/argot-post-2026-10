// Every hover ends: the pointer has left the page (a figure's frame),
// or the page lost the focus. One window event, "ethdebug:unhover";
// each holder of a hover (a lens's store, a view's own) clears on it.
export const UNHOVER = "ethdebug:unhover";
export const unhover = () => dispatchEvent(new Event(UNHOVER));

// The page's side: the pointer leaving its document (pointerleave on
// the root; a mouseout to nothing, where a quick exit fires no
// pointerleave), the window's blur, and the host's word ({ type:
// "ethdebug:pointer-out" } from the parent frame, on its pointerleave
// of the frame), each ends every hover
export function followPointerOut() {
  document.documentElement.addEventListener("pointerleave", unhover);
  addEventListener("mouseout", (e) => {
    if (!e.relatedTarget) unhover();
  });
  addEventListener("blur", unhover);
  addEventListener("message", (e) => {
    if (e.source === parent && e.data?.type === "ethdebug:pointer-out") {
      unhover();
    }
  });
}

// (a touch's pointer hovers nothing: a tap selects alone. The last
// pointer's kind, kept by the lens's listener; a key, none)
export const touch = { on: false };
