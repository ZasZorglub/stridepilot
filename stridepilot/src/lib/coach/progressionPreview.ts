import { CoachDecision } from "./coachDecision";
import { TrainingBlock } from "./trainingBlock";

type ProgressionPreviewInput = {
  decision: CoachDecision;
  block: TrainingBlock;
};

const PREVIEW_VARIANTS: Record<CoachDecision["type"], string[]> = {
  progress: [
    "Det betyder, at vi stille begynder at bygge lidt mere på de kommende pas.",
    "Nu kan vi roligt begynde at udvikle træningen en smule.",
    "Det næste stykke tid kan vi godt lægge lidt mere på i roligt tempo.",
  ],
  reduce_load: [
    "Det betyder, at vi holder lidt igen i de næste pas, så du kan holde overskud.",
    "Vi tager lige lidt tryk af de kommende pas, så kroppen kan følge med.",
    "De næste pas bliver lidt roligere, så du stadig kan bygge videre med overskud.",
  ],
  recovery_block: [
    "De næste pas bliver roligere, så du kan samle energi igen.",
    "Vi går ind i en kort roligere periode, så kroppen kan komme med.",
    "Det næste stykke tid holder vi det mere roligt, så du kan hente overskud ind igen.",
  ],
  confidence_build: [
    "Vi holder det enkelt næste gang, så du kan finde rytmen igen.",
    "Fokus bliver på at skabe ro og gode oplevelser i de næste pas.",
    "De næste pas skal først og fremmest give dig ro og tryghed i træningen.",
  ],
  maintain: [
    "Vi fortsætter i samme gode rytme de næste pas.",
    "Planen fortsætter som den er, fordi den fungerer godt.",
    "De næste pas følger samme rolige retning, fordi balancen ser god ud.",
  ],
};

function hashSeed(input: ProgressionPreviewInput): number {
  const seed = `${input.decision.type}|${input.block.phase}|${input.block.weekIndex}`;
  return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function generateProgressionPreview(input: ProgressionPreviewInput): string {
  const variants = PREVIEW_VARIANTS[input.decision.type];
  return variants[hashSeed(input) % variants.length];
}
