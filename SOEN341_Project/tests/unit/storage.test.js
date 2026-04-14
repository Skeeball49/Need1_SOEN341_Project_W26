// storage.test.js — Unit tests for storage layer (findUser, createUser, updateUser)
// Author: Obi (Testing & User Stories)
// Supabase is mocked — no real DB connection needed.

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures the mock object is available when vi.mock factory runs
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../supabase.js", () => ({ supabase: mockSupabase }));

import { findUser, createUser, updateUser } from "../../storage.js";

// Helper: builds a chainable Supabase query stub that resolves to `result`
function makeChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findUser
// ---------------------------------------------------------------------------
describe("findUser", () => {
  it("returns the user object when a matching record is found", async () => {
    const fakeUser = { email: "obi@test.com", password: "secret", diet: "Vegan" };
    mockSupabase.from.mockReturnValue(makeChain({ data: fakeUser, error: null }));

    const result = await findUser("obi@test.com");
    expect(result).toEqual(fakeUser);
  });

  it("returns null when Supabase returns an error (user not found)", async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: { message: "No rows" } }));

    const result = await findUser("ghost@test.com");
    expect(result).toBeNull();
  });

  it("queries the users table with the correct email", async () => {
    const chain = makeChain({ data: null, error: { message: "not found" } });
    mockSupabase.from.mockReturnValue(chain);

    await findUser("check@test.com");
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    expect(chain.eq).toHaveBeenCalledWith("email", "check@test.com");
  });
});

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------
describe("createUser", () => {
  it("returns { ok: true } on successful insert", async () => {
    mockSupabase.from.mockReturnValue(makeChain({ error: null }));

    const result = await createUser({ email: "new@test.com", password: "pass", diet: "", allergies: "" });
    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: false, message } when Supabase returns an error", async () => {
    mockSupabase.from.mockReturnValue(makeChain({ error: { message: "duplicate key" } }));

    const result = await createUser({ email: "dup@test.com", password: "pass", diet: "", allergies: "" });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("duplicate key");
  });

  it("inserts into the users table", async () => {
    const chain = makeChain({ error: null });
    mockSupabase.from.mockReturnValue(chain);

    await createUser({ email: "x@test.com", password: "p", diet: "", allergies: "" });
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    expect(chain.insert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------
describe("updateUser", () => {
  it("returns the updated user data on success", async () => {
    const updated = { email: "obi@test.com", diet: "Balanced" };
    mockSupabase.from.mockReturnValue(makeChain({ data: updated, error: null }));

    const result = await updateUser("obi@test.com", { diet: "Balanced" });
    expect(result).toEqual(updated);
  });

  it("returns null when Supabase returns an error", async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: { message: "not found" } }));

    const result = await updateUser("missing@test.com", { diet: "Keto" });
    expect(result).toBeNull();
  });

  it("targets the correct email when updating", async () => {
    const chain = makeChain({ data: {}, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await updateUser("target@test.com", { allergies: "nuts" });
    expect(chain.eq).toHaveBeenCalledWith("email", "target@test.com");
  });
});
