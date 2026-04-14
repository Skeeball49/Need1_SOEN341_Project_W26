// utils.test.js — Unit tests for pure utility functions
// Author: Obi (Testing & User Stories)

import { describe, it, expect } from "vitest";
import { getWeekStart } from "../../utils.js";

// ---------------------------------------------------------------------------
// getWeekStart
// ---------------------------------------------------------------------------
// Note: use T12:00:00 to avoid UTC-parsing shifting the date in local timezones
// April 13, 2026 = Monday; April 19 = Sunday; April 20 = next Monday
describe("getWeekStart", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = getWeekStart(new Date("2026-04-13T12:00:00")); // Monday
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the Monday of the same week for a Wednesday", () => {
    // Wednesday 2026-04-15 → Monday 2026-04-13
    expect(getWeekStart(new Date("2026-04-15T12:00:00"))).toBe("2026-04-13");
  });

  it("returns the PREVIOUS Monday for a Sunday", () => {
    // Sunday 2026-04-19 → Monday 2026-04-13
    expect(getWeekStart(new Date("2026-04-19T12:00:00"))).toBe("2026-04-13");
  });

  it("returns the same day when input is already a Monday", () => {
    expect(getWeekStart(new Date("2026-04-13T12:00:00"))).toBe("2026-04-13");
  });

  it("returns the correct Monday for a Friday", () => {
    // Friday 2026-04-17 → Monday 2026-04-13
    expect(getWeekStart(new Date("2026-04-17T12:00:00"))).toBe("2026-04-13");
  });
});

