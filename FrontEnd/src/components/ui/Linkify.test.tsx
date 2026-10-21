import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Linkify } from "./Linkify";

describe("Linkify", () => {
  it("rend les adresses web cliquables, sans la ponctuation qui les suit", () => {
    render(<Linkify text="Voir https://exemple.fr/doc?id=4. Et (http://intranet/wiki)" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://exemple.fr/doc?id=4",
      "http://intranet/wiki",
    ]);
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ne fait de lien qu'avec une adresse http(s)", () => {
    render(<Linkify text="javascript:alert(1) ou www.exemple.fr" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
