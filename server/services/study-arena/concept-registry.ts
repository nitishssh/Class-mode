export interface StudyArenaConcept {
  id: string;
  label: string;
  subject: string;
  prerequisites: string[];
}

const concepts: Record<string, StudyArenaConcept> = {
  "linear-equations-isolation": {
    id: "linear-equations-isolation",
    label: "Isolating a variable in a linear equation",
    subject: "Mathematics",
    prerequisites: [],
  },
  photosynthesis: {
    id: "photosynthesis",
    label: "Photosynthesis inputs and outputs",
    subject: "Science",
    prerequisites: [],
  },
  "english-reading-inference": {
    id: "english-reading-inference",
    label: "Making a textual inference with supporting evidence",
    subject: "English",
    prerequisites: [],
  },
  "social-studies-causation": {
    id: "social-studies-causation",
    label: "Explaining historical cause and effect",
    subject: "Social Studies",
    prerequisites: [],
  },
};

export function getStudyArenaConcept(id: string): StudyArenaConcept | null {
  return concepts[id] ?? null;
}
