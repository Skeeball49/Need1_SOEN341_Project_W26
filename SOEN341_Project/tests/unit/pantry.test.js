// pantry.test.js — Unit tests for pantry/grocery consolidation logic
// Author: Santiago (Frontend Dev)

import { describe, it, expect } from "vitest";
import { consolidateIngredients, categorizeIngredient } from "../../utils.js";

describe("consolidateIngredients", () => {
  it("returns all ingredients as toBuy when pantry is empty", () => {
    const recipes = [
      { ingredients: ["2 cups flour", "1 egg"], cost: 5 },
    ];

    const { groceryList } = consolidateIngredients(recipes, []);

    expect(groceryList).toHaveLength(2);
    const flour = groceryList.find(i => i.name === "cups flour");
    expect(flour.toBuy).toBe(2);
    expect(flour.inPantry).toBe(0);
  });

  it("subtracts pantry quantity from needed amount", () => {
    const recipes = [{ ingredients: ["4 eggs"], cost: 2 }];
    const pantry  = [{ ingredient_name: "eggs", quantity: 2, category: "Other" }];

    const { groceryList } = consolidateIngredients(recipes, pantry);

    const eggs = groceryList.find(i => i.name === "eggs");
    expect(eggs.needed).toBe(4);
    expect(eggs.inPantry).toBe(2);
    expect(eggs.toBuy).toBe(2);
  });

  it("excludes ingredients fully covered by the pantry", () => {
    const recipes = [{ ingredients: ["2 cups milk"], cost: 1 }];
    const pantry  = [{ ingredient_name: "cups milk", quantity: 5, category: "Dairy" }];

    const { groceryList } = consolidateIngredients(recipes, pantry);

    expect(groceryList).toHaveLength(0);
  });

  it("sums ingredients across multiple recipes", () => {
    const recipes = [
      { ingredients: ["2 cups flour"], cost: 3 },
      { ingredients: ["3 cups flour"], cost: 4 },
    ];

    const { groceryList } = consolidateIngredients(recipes, []);

    const flour = groceryList.find(i => i.name === "cups flour");
    expect(flour.needed).toBe(5);
  });

  it("calculates totalCost as the sum of all recipe costs", () => {
    const recipes = [
      { ingredients: ["1 egg"], cost: 3 },
      { ingredients: ["1 banana"], cost: 2 },
    ];

    const { totalCost } = consolidateIngredients(recipes, []);
    expect(totalCost).toBe(5);
  });

  it("returns an empty groceryList when no recipes are provided", () => {
    const { groceryList, totalCost } = consolidateIngredients([], []);
    expect(groceryList).toHaveLength(0);
    expect(totalCost).toBe(0);
  });
});

describe("categorizeIngredient", () => {
  it('categorizes milk as "Dairy"', () => {
    expect(categorizeIngredient("whole milk")).toBe("Dairy");
  });

  it('categorizes cheese as "Dairy"', () => {
    expect(categorizeIngredient("cheddar cheese")).toBe("Dairy");
  });

  it('categorizes chicken as "Meat"', () => {
    expect(categorizeIngredient("chicken breast")).toBe("Meat");
  });

  it('categorizes tomato as "Produce"', () => {
    expect(categorizeIngredient("roma tomato")).toBe("Produce");
  });

  it('categorizes bread as "Grains"', () => {
    expect(categorizeIngredient("whole wheat bread")).toBe("Grains");
  });

  it('categorizes an unknown ingredient as "Other"', () => {
    expect(categorizeIngredient("vegetable oil")).toBe("Other");
  });
});
