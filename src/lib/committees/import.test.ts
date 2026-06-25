import { describe, expect, it } from "vitest";

import {
  buildLegislatorIndex,
  flattenCommittees,
  normalizePersonName,
  shapeCommitteeAssignments,
} from "./import";

const legislators = [
  {
    id: { bioguide: "P000197" },
    name: {
      first: "Nancy",
      last: "Pelosi",
      official_full: "Nancy Pelosi",
    },
    terms: [
      { type: "rep", state: "CA", start: "2025-01-03" },
    ],
  },
  {
    id: { bioguide: "C001120" },
    name: {
      first: "Dan",
      last: "Crenshaw",
      official_full: "Dan Crenshaw",
    },
    terms: [
      { type: "rep", state: "TX", start: "2025-01-03" },
    ],
  },
];

const committees = [
  {
    type: "house",
    name: "House Committee on Armed Services",
    thomas_id: "HSAS",
    url: "https://armedservices.house.gov/",
    subcommittees: [
      { name: "Cyber, Information Technologies, and Innovation", thomas_id: "26" },
    ],
  },
];

describe("committee import shaping", () => {
  it("normalizes names across direct and last-name-first formats", () => {
    expect(normalizePersonName("Pelosi, Nancy")).toBe("nancy pelosi");
    expect(normalizePersonName("Hon. Nancy P. Pelosi Jr.")).toBe("nancy p pelosi jr");
  });

  it("indexes current legislators by bioguide and normalized name/state/chamber", () => {
    const index = buildLegislatorIndex(legislators);

    expect(index.byBioguide.get("P000197")?.displayName).toBe("Nancy Pelosi");
    expect(index.byKey.get("nancy pelosi|CA|House")?.bioguideId).toBe("P000197");
  });

  it("flattens committees and subcommittees into stable codes", () => {
    const rows = flattenCommittees(committees);

    expect(rows).toEqual([
      {
        code: "HSAS",
        name: "House Committee on Armed Services",
        chamber: "house",
        type: "committee",
        url: "https://armedservices.house.gov/",
        parentCode: null,
      },
      {
        code: "HSAS26",
        name: "House Committee on Armed Services: Cyber, Information Technologies, and Innovation",
        chamber: "house",
        type: "subcommittee",
        url: null,
        parentCode: "HSAS",
      },
    ]);
  });

  it("shapes membership assignments using bioguide ids and role flags", () => {
    const assignmentRows = shapeCommitteeAssignments(
      {
        HSAS: [
          { name: "Nancy Pelosi", bioguide: "P000197", party: "minority", rank: 1, title: "Ranking Member" },
          { name: "Dan Crenshaw", bioguide: "C001120", party: "majority", rank: 2 },
        ],
      },
      new Map(flattenCommittees(committees).map((row) => [row.code, row])),
      buildLegislatorIndex(legislators),
    );

    expect(assignmentRows).toEqual([
      {
        bioguideId: "P000197",
        committeeCode: "HSAS",
        role: "Ranking Member",
        rank: 1,
        partySide: "minority",
        isChair: false,
        isRanking: true,
      },
      {
        bioguideId: "C001120",
        committeeCode: "HSAS",
        role: null,
        rank: 2,
        partySide: "majority",
        isChair: false,
        isRanking: false,
      },
    ]);
  });
});
