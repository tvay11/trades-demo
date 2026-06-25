import { describe, it, expect } from "vitest";
import { shapeTopTraders, type TopTraderInput } from "./topTraders";

function trade(partial: Partial<TopTraderInput>): TopTraderInput {
  return {
    politicianId: 1,
    name: "Pelosi, Nancy",
    party: "D",
    state: "CA",
    chamber: "House",
    amountMin: 1000,
    amountMax: 15000,
    ...partial,
  };
}

describe("shapeTopTraders", () => {
  it("returns empty array for empty input", () => {
    expect(shapeTopTraders([], 15)).toEqual([]);
  });

  it("aggregates count and total minimum per politician", () => {
    const out = shapeTopTraders(
      [
        trade({ politicianId: 1, name: "Pelosi", amountMin: 1000, amountMax: 15000 }),
        trade({ politicianId: 1, name: "Pelosi", amountMin: 0, amountMax: 1000 }),
        trade({ politicianId: 2, name: "Tuberville", party: "R", amountMin: 0, amountMax: 1000 }),
      ],
      15,
    );
    const pelosi = out.find((r) => r.politicianId === 1);
    expect(pelosi).toMatchObject({ politicianId: 1, name: "Pelosi", count: 2, total: 1000 });
  });

  it("sorts by total minimum descending", () => {
    const out = shapeTopTraders(
      [
        trade({ politicianId: 1, name: "A", amountMin: 0, amountMax: 1000 }),
        trade({ politicianId: 2, name: "B", amountMin: 1000, amountMax: 15000 }),
        trade({ politicianId: 3, name: "C", amountMin: 100, amountMax: 500 }),
      ],
      15,
    );
    expect(out.map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("respects the limit", () => {
    const inputs = ["A", "B", "C", "D", "E"].map((n, i) =>
      trade({ politicianId: i + 1, name: n, amountMin: i * 1000, amountMax: i * 1000 }),
    );
    const out = shapeTopTraders(inputs, 3);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.name)).toEqual(["E", "D", "C"]);
  });

  it("groups by politicianId not name", () => {
    const out = shapeTopTraders(
      [
        trade({ politicianId: 1, name: "Same Name", amountMin: 100, amountMax: 100 }),
        trade({ politicianId: 2, name: "Same Name", amountMin: 100, amountMax: 100 }),
      ],
      15,
    );
    expect(out).toHaveLength(2);
  });

  it("handles null amount bounds", () => {
    const out = shapeTopTraders(
      [
        trade({ politicianId: 1, amountMin: null, amountMax: null }),
        trade({ politicianId: 1, amountMin: 100, amountMax: null }),
      ],
      15,
    );
    expect(out[0]).toMatchObject({ count: 2, total: 100 });
  });
});
