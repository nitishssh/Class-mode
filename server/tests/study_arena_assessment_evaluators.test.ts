import { describe, expect, it } from "vitest";
import { evaluateAssessment } from "../services/study-arena/assessment-evaluators";
import {
  lessonScriptSchema,
  scienceTemplateSchema,
  subjectForTemplate,
  subjectTemplateSchema,
} from "../services/study-arena/lesson-script";
import { getRecommendedNextAction } from "../services/study-arena/adaptive-policy";

describe("Study Arena science template", () => {
  it("requires grounded source coverage and a versioned evaluator", () => {
    expect(
      scienceTemplateSchema.safeParse({
        templateId: "science-explanation-v1",
        objectiveTaxonomy: "explain-cause-effect",
        evaluatorVersion: "science-explanation-v1",
        sourceSpans: [
          {
            sourceLabel: "Textbook",
            excerpt:
              "Photosynthesis uses light energy to transform carbon dioxide and water into glucose.",
          },
        ],
      }).success
    ).toBe(true);
  });

  it("accepts an accessible semantic highlight action", () => {
    expect(
      lessonScriptSchema.safeParse({
        topic: "Photosynthesis",
        conceptIds: ["photosynthesis"],
        scenes: [
          {
            id: "inputs",
            actions: [
              {
                type: "highlight",
                target: "Leaf diagram",
                label: "Notice that carbon dioxide enters through the leaf.",
              },
              {
                type: "ask",
                agent: "teacher",
                prompt: "What enters the leaf?",
                expects: "freeText",
                gate: true,
              },
            ],
          },
        ],
      }).success
    ).toBe(true);
  });

  it("evaluates the Science transfer check with a server-owned rubric", () => {
    expect(
      evaluateAssessment(
        "photosynthesis-transfer",
        "Light and carbon dioxide help the plant make glucose."
      ).correct
    ).toBe(true);
    expect(
      evaluateAssessment("photosynthesis-transfer", "Plants make food from soil.").misconceptionCode
    ).toBe("photosynthesis-input-output");
  });

  it("keeps adaptive recommendations server-policy bounded", () => {
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.8,
        prerequisiteMastery: null,
        helpDepth: 1,
      })
    ).toBe("schedule_recall");
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.2,
        prerequisiteMastery: 0.2,
        helpDepth: 1,
      })
    ).toBe("prerequisite_refresh");
  });
});

describe("Study Arena English and Social Studies templates", () => {
  const sourceSpans = [
    {
      sourceLabel: "Approved class text",
      sourceLocator: "paragraph 2",
      excerpt:
        "Mira left her umbrella by the door, but dark clouds gathered before she walked home.",
    },
  ];

  it("requires source evidence and server-only English inference targets", () => {
    const template = subjectTemplateSchema.parse({
      templateId: "english-reading-inference-v1",
      objectiveTaxonomy: "make-textual-inference",
      evaluatorVersion: "english-reading-inference-v1",
      sourceSpans,
      evaluationTargets: {
        acceptedInferences: ["Mira may get wet"],
        requiredEvidenceTerms: ["dark clouds"],
      },
    });
    expect(subjectForTemplate(template)).toBe("english");
    expect(
      evaluateAssessment(
        "english-reading-inference",
        "Mira may get wet because the dark clouds gathered.",
        template.evaluationTargets
      )
    ).toMatchObject({ correct: true, misconceptionCode: null });
    expect(
      evaluateAssessment(
        "english-reading-inference",
        "Mira may get wet.",
        template.evaluationTargets
      )
    ).toMatchObject({ correct: false, misconceptionCode: "missing-textual-evidence" });
  });

  it("evaluates Social Studies cause-and-effect without an LLM", () => {
    const template = subjectTemplateSchema.parse({
      templateId: "social-studies-causation-v1",
      objectiveTaxonomy: "explain-cause-effect",
      evaluatorVersion: "social-studies-causation-v1",
      sourceSpans: [
        {
          sourceLabel: "Approved history source",
          excerpt: "High grain taxes caused hardship, and protests spread through the city.",
        },
      ],
      evaluationTargets: {
        acceptedCauses: ["high grain taxes"],
        acceptedEffects: ["protests spread"],
      },
    });
    expect(subjectForTemplate(template)).toBe("social studies");
    expect(
      evaluateAssessment(
        "social-studies-causation",
        "High grain taxes caused hardship, so protests spread through the city.",
        template.evaluationTargets
      )
    ).toMatchObject({ correct: true, confidence: 1 });
    expect(
      evaluateAssessment(
        "social-studies-causation",
        "There were high grain taxes.",
        template.evaluationTargets
      )
    ).toMatchObject({ correct: false, misconceptionCode: "missing-historical-effect" });
  });

  it("keeps the new assessment identifiers valid in the shared scene contract", () => {
    expect(
      lessonScriptSchema.safeParse({
        topic: "Reading evidence",
        scenes: [
          {
            id: "transfer",
            actions: [
              {
                type: "assessment",
                agent: "teacher",
                assessmentId: "english-reading-inference",
                prompt: "Make an inference and cite the text.",
                gate: true,
              },
            ],
          },
        ],
      }).success
    ).toBe(true);
  });
});
