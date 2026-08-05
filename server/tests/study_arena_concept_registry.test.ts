import { describe, it, expect } from "vitest";
import { getStudyArenaConcept } from "../services/study-arena/concept-registry";

describe("getStudyArenaConcept", () => {
  it("returns linear-equations-isolation with expected fields", () => {
    const concept = getStudyArenaConcept("linear-equations-isolation");
    expect(concept).toEqual({
      id: "linear-equations-isolation",
      label: "Isolating a variable in a linear equation",
      subject: "Mathematics",
      prerequisites: [],
    });
  });

  it("returns photosynthesis with expected fields", () => {
    const concept = getStudyArenaConcept("photosynthesis");
    expect(concept).toEqual({
      id: "photosynthesis",
      label: "Photosynthesis inputs and outputs",
      subject: "Science",
      prerequisites: [],
    });
  });

  it("returns english-reading-inference with expected fields", () => {
    const concept = getStudyArenaConcept("english-reading-inference");
    expect(concept).toEqual({
      id: "english-reading-inference",
      label: "Making a textual inference with supporting evidence",
      subject: "English",
      prerequisites: [],
    });
  });

  it("returns social-studies-causation with expected fields", () => {
    const concept = getStudyArenaConcept("social-studies-causation");
    expect(concept).toEqual({
      id: "social-studies-causation",
      label: "Explaining historical cause and effect",
      subject: "Social Studies",
      prerequisites: [],
    });
  });

  it("returns null for an unknown concept id", () => {
    expect(getStudyArenaConcept("unknown-concept")).toBeNull();
    expect(getStudyArenaConcept("")).toBeNull();
  });
});
