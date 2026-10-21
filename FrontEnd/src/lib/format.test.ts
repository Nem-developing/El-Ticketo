import { describe, expect, it } from "vitest";

import { ageInDays, formatDuration, formatRelative, formatSize } from "./format";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("formatRelative", () => {
  it.each([
    ["2026-10-20T11:59:30Z", "à l'instant"],
    ["2026-10-20T11:55:00Z", "il y a 5 minutes"],
    ["2026-10-20T09:00:00Z", "il y a 3 heures"],
    ["2026-10-19T12:00:00Z", "hier"],
    ["2026-10-06T12:00:00Z", "il y a 2 semaines"],
  ])("%s → %s", (iso, expected) => {
    expect(formatRelative(iso, NOW).replace(/\s/g, " ")).toBe(expected);
  });
});

describe("ageInDays", () => {
  it("compte les jours entiers écoulés", () => {
    expect(ageInDays("2026-10-13T13:00:00Z", NOW)).toBe(6);
    expect(ageInDays("2026-10-13T11:00:00Z", NOW)).toBe(7);
  });
});

describe("formatSize et formatDuration", () => {
  it.each([
    [512, "512 o"],
    [2048, "2 Ko"],
    [1.5 * 1024 ** 2, "1,5 Mo"],
    [1024 ** 3, "1 Go"],
  ])("%d octets → %s", (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });

  it.each([
    [0.25, "15 min"],
    [5.4, "5 h"],
    [60, "2,5 j"],
  ])("%s h → %s", (hours, expected) => {
    expect(formatDuration(hours)).toBe(expected);
  });
});
