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
