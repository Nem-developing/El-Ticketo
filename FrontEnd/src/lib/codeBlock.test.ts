import { describe, expect, it } from "vitest";

import { wrapInCodeBlock } from "./codeBlock";

describe("wrapInCodeBlock", () => {
  it("place un bloc vide au curseur, sur ses propres lignes", () => {
    expect(wrapInCodeBlock("Voici :", 7, 7)).toEqual({ text: "Voici :\n```\n\n```", caret: 12 });
    expect(wrapInCodeBlock("", 0, 0)).toEqual({ text: "```\n\n```", caret: 4 });
  });

  it("entoure la sélection", () => {
    const value = "Erreur : npm ERR! 404 puis rien";
    const { text, caret } = wrapInCodeBlock(value, 9, 21);
    expect(text).toBe("Erreur : \n```\nnpm ERR! 404\n```\n puis rien");
    expect(text.slice(0, caret)).toBe("Erreur : \n```\nnpm ERR! 404");
  });
});
