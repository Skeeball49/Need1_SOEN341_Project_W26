// auth.test.js — Unit tests for registration validation logic
// Author: Sebastien (Scrum Master)

import { describe, it, expect } from "vitest";
import { validateRegistration, validatePasswordChange } from "../../utils.js";

describe("validateRegistration", () => {
  it("returns valid:true when all fields are correctly provided", () => {
    const result = validateRegistration("user@test.com", "password123", "password123");
    expect(result.valid).toBe(true);
  });

  it("returns an error when email is missing", () => {
    const result = validateRegistration("", "password123", "password123");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Please fill in all fields.");
  });

  it("returns an error when password is missing", () => {
    const result = validateRegistration("user@test.com", "", "password123");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Please fill in all fields.");
  });

  it("returns an error when confirmPassword is missing", () => {
    const result = validateRegistration("user@test.com", "password123", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Please fill in all fields.");
  });

  it("returns an error when passwords do not match", () => {
    const result = validateRegistration("user@test.com", "password123", "different456");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Passwords do not match.");
  });
});

describe("validatePasswordChange", () => {
  const user = { email: "obi@test.com", password: "oldPass1" };

  it("returns valid:true when current password matches and new passwords agree", () => {
    const result = validatePasswordChange(user, "oldPass1", "newPass2", "newPass2");
    expect(result.valid).toBe(true);
  });

  it("returns an error when the current password is wrong", () => {
    const result = validatePasswordChange(user, "wrongPass", "newPass2", "newPass2");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Current password is incorrect.");
  });

  it("returns an error when user is null (not found)", () => {
    const result = validatePasswordChange(null, "any", "newPass2", "newPass2");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Current password is incorrect.");
  });

  it("returns an error when new passwords do not match", () => {
    const result = validatePasswordChange(user, "oldPass1", "newPass2", "different");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("New passwords do not match.");
  });
});
