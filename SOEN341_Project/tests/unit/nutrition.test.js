// nutrition.test.js — Unit tests for daily breakdown and weekly stats calculations
// Author: Amir (Documentation)

import { describe, it, expect } from "vitest";
import { calculateDailyBreakdown, calculateWeeklyStats, calculateMatchPercentage } from "../../utils.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

describe("calculateDailyBreakdown", () => {
  it("returns one entry per day with correct macro totals", () => {
    const planEntries = [
      { day: "Monday", recipe_id: 1 },
      { day: "Wednesday", recipe_id: 2 },
    ];
    const recipeMap = {
      1: { calories: 500, protein: 30, carbs: 60, fat: 15 },
      2: { calories: 700, protein: 40, carbs: 80, fat: 20 },
    };

    const breakdown = calculateDailyBreakdown(planEntries, recipeMap, DAYS);

    expect(breakdown).toHaveLength(7);
    expect(breakdown.find(d => d.day === "Monday")).toMatchObject({ calories: 500, protein: 30, carbs: 60, fat: 15 });
    expect(breakdown.find(d => d.day === "Wednesday")).toMatchObject({ calories: 700, protein: 40, carbs: 80, fat: 20 });
  });

  it("returns zeros for days with no planned meals", () => {
    const breakdown = calculateDailyBreakdown([], {}, DAYS);

    for (const entry of breakdown) {
      expect(entry.calories).toBe(0);
      expect(entry.protein).toBe(0);
    }
  });

  it("sums macros when a day has multiple meals planned", () => {
    const planEntries = [
      { day: "Tuesday", recipe_id: 1 },
      { day: "Tuesday", recipe_id: 2 },
    ];
    const recipeMap = {
      1: { calories: 300, protein: 10, carbs: 40, fat: 5 },
      2: { calories: 400, protein: 20, carbs: 50, fat: 10 },
    };

    const breakdown = calculateDailyBreakdown(planEntries, recipeMap, DAYS);
    const tuesday = breakdown.find(d => d.day === "Tuesday");

    expect(tuesday.calories).toBe(700);
    expect(tuesday.protein).toBe(30);
  });

  it("skips entries whose recipe_id is not in recipeMap", () => {
    const planEntries = [{ day: "Friday", recipe_id: 999 }];
    const recipeMap   = {};

    const breakdown = calculateDailyBreakdown(planEntries, recipeMap, DAYS);
    const friday = breakdown.find(d => d.day === "Friday");

    expect(friday.calories).toBe(0);
  });
});

describe("calculateWeeklyStats", () => {
  it("correctly sums all macros across the week", () => {
    const daily = [
      { day: "Monday",    calories: 500, protein: 30, carbs: 60, fat: 15 },
      { day: "Tuesday",   calories: 700, protein: 40, carbs: 80, fat: 20 },
      { day: "Wednesday", calories: 600, protein: 35, carbs: 70, fat: 18 },
      { day: "Thursday",  calories: 0,   protein: 0,  carbs: 0,  fat: 0  },
      { day: "Friday",    calories: 0,   protein: 0,  carbs: 0,  fat: 0  },
      { day: "Saturday",  calories: 0,   protein: 0,  carbs: 0,  fat: 0  },
      { day: "Sunday",    calories: 0,   protein: 0,  carbs: 0,  fat: 0  },
    ];

    const stats = calculateWeeklyStats(daily);

    expect(stats.calories).toBe(1800);
    expect(stats.protein).toBe(105);
    expect(stats.carbs).toBe(210);
    expect(stats.fat).toBe(53);
  });

  it("returns all zeros for an empty week", () => {
    const daily = DAYS.map(day => ({ day, calories: 0, protein: 0, carbs: 0, fat: 0 }));
    const stats = calculateWeeklyStats(daily);

    expect(stats).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("returns a plain object with exactly the four macro keys", () => {
    const stats = calculateWeeklyStats([{ day: "Monday", calories: 100, protein: 5, carbs: 10, fat: 3 }]);
    expect(Object.keys(stats)).toEqual(["calories", "protein", "carbs", "fat"]);
  });
});

describe("calculateMatchPercentage", () => {
  it("returns 100 when pantry has all recipe ingredients", () => {
    const recipe = { ingredients: ["2 cups flour", "1 egg", "1 cup milk"] };
    const pantry = ["flour", "egg", "milk"];
    expect(calculateMatchPercentage(recipe, pantry)).toBe(100);
  });

  it("returns 0 when pantry is empty", () => {
    const recipe = { ingredients: ["2 cups flour", "1 egg"] };
    expect(calculateMatchPercentage(recipe, [])).toBe(0);
  });

  it("returns 0 when no ingredients match", () => {
    const recipe = { ingredients: ["2 cups flour", "1 egg"] };
    const pantry = ["salmon", "broccoli"];
    expect(calculateMatchPercentage(recipe, pantry)).toBe(0);
  });

  it("returns 50 when half the ingredients match", () => {
    const recipe = { ingredients: ["2 cups flour", "1 egg", "1 cup milk", "butter"] };
    const pantry = ["flour", "egg"];
    expect(calculateMatchPercentage(recipe, pantry)).toBe(50);
  });

  it("normalizes pantry ingredient names before matching", () => {
    const recipe = { ingredients: ["1 cup milk"] };
    const pantry = ["cup milk"];
    expect(calculateMatchPercentage(recipe, pantry)).toBe(100);
  });

  it("returns 0 for a recipe with no ingredients", () => {
    const recipe = { ingredients: [] };
    expect(calculateMatchPercentage(recipe, ["egg", "flour"])).toBe(0);
  });
});
