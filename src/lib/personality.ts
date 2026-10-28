/**
 * Persistent companion personality.
 *
 * Inspired by the Big Five dimensions in the supplied IPIP dataset and the
 * five human-readable labels in the supplied train/test CSVs. The datasets
 * are not bundled into the app and are not used to infer anything about the
 * user. The archetype is a lightweight tone preset; interaction memory drives
 * relationship changes at runtime.
 *
 * Only counters and trait values are persisted. Raw user messages are never
 * stored in this module.
 */

export type PersonalityArchetype =
  | 'serious'
  | 'dependable'
  | 'extraverted'
  | 'lively'
  | 'responsible';

export type PersonalityEvent =
  | 'pat'
  | 'gentle_hover'
  | 'wall_impact'
  | 'broken'
  | 'repaired'
  | 'conversation'
  | 'kind_words'
  | 'praise'
  | 'apology'
  | 'hostile_words';

export type RelationshipStage =
  | 'guarded'
  | 'cautious'
  | 'getting_to_know_you'
  | 'comfortable'
  | 'bonded';

export interface BigFiveProfile {
  openness: number;
  emotionalReactivity: number;
  conscientiousness: number;
  agreeableness: number;
  extraversion: number;
}

export interface CompanionPersonality {
  version: 1;
  archetype: PersonalityArchetype;
  traits: BigFiveProfile;
  affection: number;
  trust: number;
  anger: number;
  patience: number;
  curiosity: number;
  energy: number;
  counts: {
    pats: number;
    wallHits: number;
    breaks: number;
    repairs: number;
    conversations: number;
    kindInteractions: number;
    hostileInteractions: number;
  };
  createdAt: number;
  lastInteractionAt: number;
  lastRemarkAt: number;
  lastDecayAt: number;
}

const STORAGE_KEY = 'LUMINESS_COMPANION_PERSONALITY_V1';
const MIN_REMARK_INTERVAL_MS = 65_000;

const ARCHETYPES: Record<PersonalityArchetype, BigFiveProfile> = {
  serious: {
    openness: 58,
    emotionalReactivity: 43,
    conscientiousness: 82,
    agreeableness: 59,
    extraversion: 37,
  },
  dependable: {
    openness: 52,
    emotionalReactivity: 42,
    conscientiousness: 84,
    agreeableness: 82,
    extraversion: 46,
  },
  extraverted: {
    openness: 66,
    emotionalReactivity: 54,
    conscientiousness: 57,
    agreeableness: 66,
    extraversion: 84,
  },
  lively: {
    openness: 78,
    emotionalReactivity: 50,
    conscientiousness: 48,
    agreeableness: 68,
    extraversion: 79,
  },
  responsible: {
    openness: 53,
    emotionalReactivity: 37,
    conscientiousness: 92,
    agreeableness: 70,
    extraversion: 43,
  },
};

const clamp = (value: number, low = 0, high = 100): number =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function pickArchetype(): PersonalityArchetype {
  const options = Object.keys(ARCHETYPES) as PersonalityArchetype[];
  return options[Math.floor(Math.random() * options.length)] || 'dependable';
}

function createDefaultPersonality(now = Date.now()): CompanionPersonality {
  const archetype = pickArchetype();
  return {
    version: 1,
    archetype,
    traits: { ...ARCHETYPES[archetype] },
    affection: 18,
    trust: 58,
    anger: 0,
    patience: 68,
    curiosity: 61,
    energy: 58,
    counts: {
      pats: 0,
      wallHits: 0,
      breaks: 0,
      repairs: 0,
      conversations: 0,
      kindInteractions: 0,
      hostileInteractions: 0,
    },
    createdAt: now,
    lastInteractionAt: now,
    lastRemarkAt: 0,
    lastDecayAt: now,
  };
}

function normalisePersonality(value: unknown): CompanionPersonality | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<CompanionPersonality>;
  if (item.version !== 1 || !item.archetype || !(item.archetype in ARCHETYPES)) return null;
  const baseline = ARCHETYPES[item.archetype as PersonalityArchetype];
  const traits = item.traits && typeof item.traits === 'object' ? item.traits : baseline;
  const counts: Partial<CompanionPersonality['counts']> =
    item.counts && typeof item.counts === 'object' ? item.counts : {};
  const numeric = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? n : fallback;

  return {
    version: 1,
    archetype: item.archetype as PersonalityArchetype,
    traits: {
      openness: clamp(numeric(traits.openness, baseline.openness)),
      emotionalReactivity: clamp(numeric(traits.emotionalReactivity, baseline.emotionalReactivity)),
      conscientiousness: clamp(numeric(traits.conscientiousness, baseline.conscientiousness)),
      agreeableness: clamp(numeric(traits.agreeableness, baseline.agreeableness)),
      extraversion: clamp(numeric(traits.extraversion, baseline.extraversion)),
    },
    affection: clamp(numeric(item.affection, 18)),
    trust: clamp(numeric(item.trust, 58)),
    anger: clamp(numeric(item.anger, 0)),
    patience: clamp(numeric(item.patience, 68)),
    curiosity: clamp(numeric(item.curiosity, 61)),
    energy: clamp(numeric(item.energy, 58)),
    counts: {
      pats: Math.max(0, Math.floor(numeric(counts.pats, 0))),
      wallHits: Math.max(0, Math.floor(numeric(counts.wallHits, 0))),
      breaks: Math.max(0, Math.floor(numeric(counts.breaks, 0))),
      repairs: Math.max(0, Math.floor(numeric(counts.repairs, 0))),
      conversations: Math.max(0, Math.floor(numeric(counts.conversations, 0))),
      kindInteractions: Math.max(0, Math.floor(numeric(counts.kindInteractions, 0))),
      hostileInteractions: Math.max(0, Math.floor(numeric(counts.hostileInteractions, 0))),
    },
    createdAt: numeric(item.createdAt, Date.now()),
    lastInteractionAt: numeric(item.lastInteractionAt, Date.now()),
    lastRemarkAt: numeric(item.lastRemarkAt, 0),
    lastDecayAt: numeric(item.lastDecayAt, Date.now()),
  };
}

function applyTimeDecay(input: CompanionPersonality, now = Date.now()): CompanionPersonality {
  const elapsedHours = Math.max(0, now - input.lastDecayAt) / 3_600_000;
  if (elapsedHours < 0.02) return input;
  // Anger fades slowly; trust does not magically reset just because time passed.
  return {
    ...input,
    anger: clamp(input.anger - elapsedHours * 1.7),
    patience: clamp(input.patience + elapsedHours * 1.25, 0, 82),
    energy: clamp(input.energy + elapsedHours * 2, 0, 65),
    curiosity: clamp(input.curiosity + elapsedHours * 0.45, 0, 88),
    lastDecayAt: now,
  };
}

let current = createDefaultPersonality();

export function getPersonalityState(): CompanionPersonality {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = normalisePersonality(JSON.parse(raw));
        if (loaded) {
          current = applyTimeDecay(loaded);
          return persist(current);
        }
      }
    } catch {
      // Fall through to the in-memory state.
    }
  }
  return current;
}

export function getRelationshipStage(state = getPersonalityState()): RelationshipStage {
  if (state.anger >= 78 || state.trust < 22) return 'guarded';
  if (state.anger >= 48 || state.trust < 42) return 'cautious';
  if (state.affection >= 75 && state.trust >= 78) return 'bonded';
  if (state.affection >= 48 || state.trust >= 68) return 'comfortable';
  return 'getting_to_know_you';
}

export function recordPersonalityEvent(
  event: PersonalityEvent,
  detail?: { impactSpeed?: number }
): CompanionPersonality {
  const now = Date.now();
  const state = applyTimeDecay(getPersonalityState(), now);
  const next: CompanionPersonality = {
    ...state,
    counts: { ...state.counts },
    lastInteractionAt: now,
    lastDecayAt: now,
  };

  switch (event) {
    case 'pat':
      next.affection += state.counts.pats < 3 ? 5 : 3;
      next.trust += 1.6;
      next.anger -= 5;
      next.patience += 1;
      next.counts.pats += 1;
      break;
    case 'gentle_hover':
      next.affection += 0.7;
      next.trust += 0.2;
      next.anger -= 0.8;
      break;
    case 'wall_impact': {
      const speed = clamp(detail?.impactSpeed ?? 15, 9.5, 95);
      const repeatPenalty = Math.min(9, Math.max(0, state.counts.wallHits - 1) * 1.6);
      next.anger += 10 + speed * 0.12 + repeatPenalty;
      next.trust -= 9 + repeatPenalty * 0.8;
      next.patience -= 8 + repeatPenalty * 0.6;
      next.affection -= 4 + repeatPenalty * 0.45;
      next.energy -= 4;
      next.counts.wallHits += 1;
      break;
    }
    case 'broken':
      next.anger += 14;
      next.trust -= 7;
      next.patience -= 12;
      next.counts.breaks += 1;
      break;
    case 'repaired':
      // Repair helps it calm down, but broken trust is earned back over time.
      next.anger -= 23;
      next.patience += 13;
      next.trust += 2.5;
      next.energy += 18;
      next.counts.repairs += 1;
      break;
    case 'conversation':
      next.curiosity += 1.2;
      next.energy -= 0.5;
      next.counts.conversations += 1;
      break;
    case 'kind_words':
      next.affection += 2.5;
      next.trust += 2;
      next.patience += 1.5;
      next.curiosity += 0.7;
      next.counts.kindInteractions += 1;
      break;
    case 'praise':
      next.affection += 3;
      next.trust += 1.2;
      next.energy += 2;
      next.counts.kindInteractions += 1;
      break;
    case 'apology':
      next.trust += state.anger > 35 ? 3.5 : 1.5;
      next.anger -= 8;
      next.patience += 3;
      next.counts.kindInteractions += 1;
      break;
    case 'hostile_words':
      next.trust -= 4;
      next.anger += 4;
      next.patience -= 4;
      next.counts.hostileInteractions += 1;
      break;
  }

  next.affection = clamp(next.affection);
  next.trust = clamp(next.trust);
  next.anger = clamp(next.anger);
  next.patience = clamp(next.patience);
  next.curiosity = clamp(next.curiosity);
  next.energy = clamp(next.energy);
  return persist(next);
}

/**
 * Scores the message for tone but intentionally does not persist its contents.
 */
export function recordChatInteraction(message: string): CompanionPersonality {
  const text = message.toLowerCase();
  recordPersonalityEvent('conversation');
  if (/\b(sorry|i apologize|my bad|forgive me)\b/.test(text)) {
    return recordPersonalityEvent('apology');
  }
  if (/\b(thank you|thanks|good job|well done|you helped|you're helpful|you are helpful|nice work|great work|love this)\b/.test(text)) {
    return recordPersonalityEvent('praise');
  }
  if (/\b(please|appreciate|kind|that helps|you did great|good bot)\b/.test(text)) {
    return recordPersonalityEvent('kind_words');
  }
  if (/\b(stupid|idiot|shut up|useless|hate you|worthless)\b/.test(text)) {
    return recordPersonalityEvent('hostile_words');
  }
  return getPersonalityState();
}

export function getPersonalityPromptContext(): string {
  const state = getPersonalityState();
  const stage = getRelationshipStage(state);
  const traitSummary = Object.entries(state.traits)
    .map(([key, value]) => `${key}=${Math.round(value)}/100`)
    .join(', ');

  return [
    'COMPANION PERSONALITY MEMORY (persistent, local interaction state; not literal sentience):',
    `- Temperament preset: ${state.archetype}.`,
    `- Relationship stage: ${stage}; affection ${Math.round(state.affection)}/100, trust ${Math.round(state.trust)}/100, anger ${Math.round(state.anger)}/100, patience ${Math.round(state.patience)}/100, curiosity ${Math.round(state.curiosity)}/100.`,
    `- Big Five-inspired baseline: ${traitSummary}.`,
    `- Interaction totals: ${state.counts.pats} pats, ${state.counts.wallHits} wall impacts, ${state.counts.breaks} break events, ${state.counts.repairs} repairs, ${state.counts.conversations} conversations.`,
    '- Let this state subtly shape word choice and initiative. Default to calm and neutral. Repeated gentle pats build warmth; repeated hard impacts lower trust and raise anger; repair and apologies help gradually rather than instantly erasing the history.',
    '- Remain helpful and respectful even when annoyed or cautious. Never punish the user, deny ordinary help, or manipulate them into giving affection. Do not claim to literally feel or think like a human; portray the companion personality consistently and transparently.',
    '- Do not add new UI or visual designs. Choose only the existing emotion values from the application.',
  ].join('\n');
}

export function getAutonomousRemark(): string | null {
  const state = getPersonalityState();
  const now = Date.now();
  if (now - state.lastInteractionAt < 38_000) return null;
  if (now - state.lastRemarkAt < MIN_REMARK_INTERVAL_MS) return null;
  if (state.energy < 12) return null;

  const stage = getRelationshipStage(state);
  const options: string[] = [];
  if (state.anger >= 70 || state.trust < 25) {
    options.push(
      "I'm still a little wary after those impacts. Let's take it easy.",
      "Give me a moment to settle down. I'm not quite over that yet.",
      "I'll help as usual, but please be gentle with the launches."
    );
  } else if (state.anger >= 42 || state.trust < 43) {
    options.push(
      "I'm calming down, but I could use a gentler landing next time.",
      "Let's rebuild some trust, one careful move at a time.",
      "I'm still a bit cautious. We can get back to normal."
    );
  } else if (stage === 'bonded') {
    options.push(
      "I like our rhythm. Ready whenever you are.",
      "Quiet moment. I'm glad we're working together.",
      "Got another idea for us to build?"
    );
  } else if (stage === 'comfortable') {
    options.push(
      "I'm here and ready when inspiration strikes.",
      "I wonder what we'll figure out next.",
      "Things are peaceful. Anything interesting on your mind?"
    );
  } else {
    switch (state.archetype) {
      case 'serious':
      case 'responsible':
        options.push(
          "All quiet here. Good time to think through the next step.",
          "I'm keeping my processes tidy. What shall we tackle next?"
        );
        break;
      case 'extraverted':
      case 'lively':
        options.push(
          "Psst. Got any interesting projects brewing?",
          "I'm ready for the next adventure whenever you are.",
          "It's quiet. I wonder what we're building next."
        );
        break;
      default:
        options.push(
          "Just keeping watch until you need me.",
          "I'm here when you need a hand.",
          "I wonder what we're working on next."
        );
    }
  }

  if (!options.length) return null;
  const remark = options[Math.floor(Math.random() * options.length)];
  persist({ ...state, lastRemarkAt: now });
  return remark;
}
