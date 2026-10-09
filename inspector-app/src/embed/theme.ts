// The host's theme (the hash's theme=light|dark, or its message
// { type: "ethdebug:theme", theme }): over the OS's preference. Both
// entries, the figure's frame and its panel's, follow it.
export function followTheme(hash: URLSearchParams) {
  const theme = (t: unknown) => {
    if (t !== "light" && t !== "dark") return;
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  };
  theme(hash.get("theme"));
  addEventListener("message", (e) => {
    if (e.data?.type === "ethdebug:theme") theme(e.data.theme);
  });
}
