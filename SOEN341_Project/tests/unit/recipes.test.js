// recipes.test.js — Unit tests for recipe object building and ingredient scaling
// Author: Ibrahim (Backend Dev)

import { describe, it, expect } from "vitest";
import { buildRecipeObject, scaleIngredient, parseIngredient } from "../../utils.js";

describe("buildRecipeObject", () => {
  it("correctly maps all fields from a full form body", () => {
    const body = {
      title: "  Pasta Carbonara  ",
      ingredients: "200g pasta\n2 eggs\n100g bacon",
      prepTime: "20",
      steps: "Boil pasta\nFry bacon\nMix eggs",
      cost: "8",
      difficulty: "Medium",
      tags: "Italian, Quick",
      servings: "2",
      calories: "600",
      protein: "25",
      carbs: "70",
      fat: "20",
      category: "Main Course",
    };

    const recipe = buildRecipeObject(body);

    expect(recipe.title).toBe("Pasta Carbonara");
    expect(recipe.ingredients).toEqual(["200g pasta", "2 eggs", "100g bacon"]);
    expect(recipe.steps).toEqual(["Boil pasta", "Fry bacon", "Mix eggs"]);
    expect(recipe.prepTime).toBe(20);
    expect(recipe.cost).toBe(8);
    expect(recipe.servings).toBe(2);
    expect(recipe.calories).toBe(600);
  });

  it("applies default values when optional numeric fields are missing", () => {
    const body = {
      title: "Simple Toast",
      ingredients: "2 slices bread",
      steps: "Toast the bread",
      prepTime: "",
      cost: "",
      servings: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      difficulty: "",
      tags: "",
      category: "",
    };

    const recipe = buildRecipeObject(body);

    expect(recipe.prepTime).toBe(0);
    expect(recipe.cost).toBe(0);
    expect(recipe.servings).toBe(4);
    expect(recipe.difficulty).toBe("Easy");
    expect(recipe.category).toBe("Main Course");
    expect(recipe.tags).toEqual([]);
  });

  it("splits and trims tags correctly", () => {
    const body = {
      title: "Salad",
      ingredients: "lettuce",
      steps: "Mix",
      prepTime: "5", cost: "2", servings: "1",
      calories: "100", protein: "2", carbs: "10", fat: "1",
      difficulty: "Easy", category: "Salad",
      tags: " Healthy ,  Vegan , Quick ",
    };

    const recipe = buildRecipeObject(body);
    expect(recipe.tags).toEqual(["Healthy", "Vegan", "Quick"]);
  });

  it("filters out blank lines from ingredients and steps", () => {
    const body = {
      title: "Soup",
      ingredients: "water\n\ncarrots\n",
      steps: "Boil\n\nServe\n",
      prepTime: "10", cost: "3", servings: "2",
      calories: "80", protein: "3", carbs: "10", fat: "1",
      difficulty: "Easy", tags: "", category: "Soup",
    };

    const recipe = buildRecipeObject(body);
    expect(recipe.ingredients).toEqual(["water", "carrots"]);
    expect(recipe.steps).toEqual(["Boil", "Serve"]);
  });

  it("converts string numbers to actual numbers", () => {
    const body = {
      title: "Steak",
      ingredients: "1 steak",
      steps: "Grill it",
      prepTime: "15", cost: "12", servings: "1",
      calories: "450", protein: "40", carbs: "0", fat: "25",
      difficulty: "Hard", tags: "", category: "Main Course",
    };

    const recipe = buildRecipeObject(body);
    expect(typeof recipe.calories).toBe("number");
    expect(typeof recipe.protein).toBe("number");
    expect(recipe.fat).toBe(25);
  });
});

describe("scaleIngredient", () => {
  it("doubles a numeric ingredient", () => {
    expect(scaleIngredient("1 cup sugar", 2)).toBe("2.0 cup sugar");
  });

  it("returns unchanged string when no leading number exists", () => {
    expect(scaleIngredient("salt to taste", 3)).toBe("salt to taste");
  });

  it("handles decimal scale factors", () => {
    expect(scaleIngredient("3 tablespoons oil", 0.5)).toBe("1.5 tablespoons oil");
  });
});

describe("parseIngredient", () => {
  it("parses an integer quantity and name", () => {
    expect(parseIngredient("2 cups flour")).toEqual({ qty: 2, name: "cups flour" });
  });

  it("parses a decimal quantity", () => {
    expect(parseIngredient("1.5 tablespoons olive oil")).toEqual({ qty: 1.5, name: "tablespoons olive oil" });
  });

  it("falls back to qty=1 when there is no leading number", () => {
    expect(parseIngredient("chicken breast")).toEqual({ qty: 1, name: "chicken breast" });
  });

  it("trims whitespace and lowercases the name", () => {
    expect(parseIngredient("  3 Eggs  ")).toEqual({ qty: 3, name: "eggs" });
  });
});
