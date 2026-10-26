/**
 * Entoure la sélection d'un bloc de code (```), sur ses propres lignes. Renvoie le texte et la
 * position du curseur, à la fin du code (sur la ligne vide quand rien n'était sélectionné).
 */
export function wrapInCodeBlock(value: string, start: number, end: number) {
  const before = value.slice(0, start);
  const code = value.slice(start, end);
  const after = value.slice(end);
  const open = `${before && !before.endsWith("\n") ? "\n" : ""}\`\`\`\n`;
  const close = `\n\`\`\`${after && !after.startsWith("\n") ? "\n" : ""}`;
  return {
    text: before + open + code + close + after,
    caret: before.length + open.length + code.length,
  };
}
