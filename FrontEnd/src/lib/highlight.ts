// Coloration syntaxique des blocs de code : chargée à la demande, seulement quand un bloc est
// affiché. Les langages les plus courants suffisent et gardent le fichier léger.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import nginx from "highlight.js/lib/languages/nginx";
import php from "highlight.js/lib/languages/php";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  go,
  ini,
  java,
  javascript,
  json,
  nginx,
  php,
  powershell,
  python,
  rust,
  shell,
  sql,
  typescript,
  xml,
  yaml,
};
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language);

// En deçà, la détection automatique se trompe plus souvent qu'elle ne devine juste.
const MIN_RELEVANCE = 5;

/**
 * HTML coloré (le code y est échappé), ou null pour l'afficher tel quel : langage inconnu
 * (« text », « log »…) ou impossible à reconnaître.
 */
export function highlight(code: string, language: string): string | null {
  if (language) {
    return hljs.getLanguage(language)
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : null;
  }
  const detected = hljs.highlightAuto(code);
  return detected.relevance >= MIN_RELEVANCE ? detected.value : null;
}
