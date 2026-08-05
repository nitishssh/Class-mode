import type {
  LessonScript,
  SceneTransition,
  SceneTransitionPredicate,
} from "./lesson-script";

export type SceneDirectorEvidence = {
  assessmentResult?: { assessmentId: string; correct: boolean };
  helpDepth: number;
  masteryByConcept: Record<string, number>;
  prerequisiteMasteryByConcept: Record<string, number>;
};

export type SceneDirectorDecision = {
  fromSceneId: string | null;
  toSceneId: string | null;
  terminal: boolean;
  rationale: string;
  transitionIndex: number | null;
};

export type SceneDirectorState = {
  currentSceneId: string | null;
  branchPath: string[];
};

function compares(value: number | undefined, operator: "gte" | "lt", target: number): boolean {
  if (value === undefined) return false;
  return operator === "gte" ? value >= target : value < target;
}

function predicateMatches(predicate: SceneTransitionPredicate, evidence: SceneDirectorEvidence): boolean {
  switch (predicate.kind) {
    case "always":
      return true;
    case "assessment_result":
      return (
        evidence.assessmentResult !== undefined &&
        evidence.assessmentResult.correct === predicate.correct &&
        (predicate.assessmentId === undefined ||
          evidence.assessmentResult.assessmentId === predicate.assessmentId)
      );
    case "help_depth":
      return compares(evidence.helpDepth, predicate.operator, predicate.value);
    case "mastery":
      return compares(
        evidence.masteryByConcept[predicate.conceptId],
        predicate.operator,
        predicate.value
      );
    case "prerequisite_mastery":
      return compares(
        evidence.prerequisiteMasteryByConcept[predicate.conceptId],
        predicate.operator,
        predicate.value
      );
  }
}

function transitionIsAvailable(
  transition: SceneTransition,
  state: SceneDirectorState,
  evidence: SceneDirectorEvidence
): boolean {
  if (!predicateMatches(transition.when, evidence)) return false;
  if (transition.maxTraversals === undefined) return true;

  const traversals = state.branchPath.filter(
    (sceneId, index) =>
      sceneId === transition.fromSceneId && state.branchPath[index + 1] === transition.toSceneId
  ).length;
  return traversals < transition.maxTraversals;
}

function implicitDecision(script: LessonScript, currentSceneId: string | null): SceneDirectorDecision {
  const currentIndex = currentSceneId === null
    ? -1
    : script.scenes.findIndex((scene) => scene.id === currentSceneId);
  const nextScene = script.scenes[currentIndex + 1];
  return {
    fromSceneId: currentSceneId,
    toSceneId: nextScene?.id ?? null,
    terminal: nextScene === undefined,
    rationale: nextScene ? "implicit_linear_next" : "implicit_linear_terminal",
    transitionIndex: null,
  };
}

/**
 * Resolves only teacher-declared routes. It has no I/O and its selection order
 * is the authored transition order, which makes decisions reproducible.
 */
export function resolveNextScene(
  script: LessonScript,
  state: SceneDirectorState,
  evidence: SceneDirectorEvidence
): SceneDirectorDecision {
  if (!script.sceneGraph) return implicitDecision(script, state.currentSceneId);

  if (state.currentSceneId === null) {
    return {
      fromSceneId: null,
      toSceneId: script.sceneGraph.entrySceneId,
      terminal: false,
      rationale: "declared_entry_scene",
      transitionIndex: null,
    };
  }

  const candidates = script.sceneGraph.transitions
    .map((transition, index) => ({ transition, index }))
    .filter(({ transition }) => transition.fromSceneId === state.currentSceneId);
  const selected = candidates.find(({ transition }) =>
    transitionIsAvailable(transition, state, evidence)
  );

  if (!selected) {
    return {
      fromSceneId: state.currentSceneId,
      toSceneId: null,
      terminal: true,
      rationale: "no_declared_transition_matched",
      transitionIndex: null,
    };
  }

  return {
    fromSceneId: state.currentSceneId,
    toSceneId: selected.transition.toSceneId ?? null,
    terminal: selected.transition.terminal === true,
    rationale: `declared_transition_${selected.index}_${selected.transition.when.kind}`,
    transitionIndex: selected.index,
  };
}
