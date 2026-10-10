// The colouring (vanilla bin/build-shiki.sh's bundle, from npm): Shiki's
// core, its JavaScript regex engine, the Solidity and YAML grammars and
// two themes; code-split, loaded the first time something is coloured
export async function highlighter() {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine },
    solidity, yaml, light, dark] = await Promise.all([
    import("shiki/core"), import("shiki/engine/javascript"),
    import("@shikijs/langs/solidity"), import("@shikijs/langs/yaml"),
    import("@shikijs/themes/github-light"),
    import("@shikijs/themes/github-dark")]);
  return createHighlighterCore({ themes: [light.default, dark.default],
    langs: [solidity.default, yaml.default],
    engine: createJavaScriptRegexEngine() });
}

// a grammar loaded only when a source needs it: Rust's, for Fe (whose
// syntax it is close to; no Fe grammar exists), by the real debugger
type Hl = Awaited<ReturnType<typeof highlighter>>;
export async function withLang(hl: Hl, lang: string): Promise<Hl> {
  if (lang === "rust" && !hl.getLoadedLanguages().includes("rust")) {
    await hl.loadLanguage((await import("@shikijs/langs/rust")).default);
  }
  return hl;
}
