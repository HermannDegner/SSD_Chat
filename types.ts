// --- Interfaces ---
export interface Message {
  sender: 'user' | number; // user or character ID
  text: string;
  // State snapshot at the time of the message
  thoughtProcess?: ThoughtProcess;
  internalState?: InternalState;
  action?: NpcAction | null;
}

export interface NpcAction {
  type: string; // e.g., 'PREPARE_FOR_BATTLE', 'GIVE_ITEM'
  details?: string; // e.g., 'rusty axe', 'a warm soup'
}

// New Four-Layer Internal State Structure
export interface InternalState {
  // 表層構造 (Surface Structure)
  surface: {
    emotion: string;
    shortTermGoal: string;
    impressionOfUser: string;
  };
  // 上層構造 (Superstructure)
  superstructure: {
    longTermGoal: string;
    narrative: string;
  };
  // 中核構造 (Core Structure)
  core: {
    normativeConsciousness: string;
    personalBeliefs: string[];
  };
  // 基層構造 (Foundational Structure)
  foundation: {
    stability: number; // 0-100
    curiosity: number; // 0-100
  };
  // Quantitative parameters remain at the top level for easy access
  likability: number;
  wariness: number;
}

export interface ThoughtProcess {
  userInputAnalysis: string;
  internalConflictAnalysis: {
    description: string;
    conflictingLayers: string[];
  };
  parameterUpdates: {
    likabilityChange: number;
    warinessChange: number;
    stabilityChange: number;
    curiosityChange: number;
  };
}

export interface NpcResponseData {
  thoughtProcess: ThoughtProcess;
  newState: InternalState;
  response: string;
  action: NpcAction | null;
}

export interface Character {
  id: number;
  name: string;
  persona: string;
  messages: Message[];
  internalState: InternalState | null;
  thoughtProcess: ThoughtProcess | null;
}