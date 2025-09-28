import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

// --- Interfaces ---
interface Message {
  sender: 'user' | number; // user or character ID
  text: string;
  // State snapshot at the time of the message
  thoughtProcess?: ThoughtProcess;
  internalState?: InternalState;
}

// New Four-Layer Internal State Structure
interface InternalState {
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

interface ThoughtProcess {
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

interface NpcResponseData {
  thoughtProcess: ThoughtProcess;
  newState: InternalState;
  response: string;
}

interface Character {
  id: number;
  name: string;
  persona: string;
  messages: Message[];
  internalState: InternalState | null;
  thoughtProcess: ThoughtProcess | null;
}


// --- Constants ---
const API_KEY = process.env.API_KEY;

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 1,
    name: "ボーリン（ドワーフ）",
    persona: `あなたは、ドワーフの鍛冶屋ボーリン・アイアンハンドです。
**[上層構造]**
- 長期的目標: 「伝説の剣を打つ」
- 物語: 「儂は代々続く鍛冶屋の家系だ。職人としての誇りが全てだ。」
**[中核構造]**
- 規範意識: 「鍛冶屋ギルドの規則は絶対だ。」
- 個人的信条: 「嘘はつかん」「約束は守る」「優れた職人技には敬意を払う」
**[基層構造]**
- エネルギーレベル: [安定性: 80], [探索欲求: 30]
**[初期パラメータ]**
- [好感度: 10], [警戒心: 70]`,
    messages: [],
    internalState: null,
    thoughtProcess: null,
  },
  {
    id: 2,
    name: "エリアーナ（エルフ）",
    persona: `あなたは、エルフの森の番人エリアーナです。
**[上層構造]**
- 長期的目標: 「古代の森を永遠に守り続ける」
- 物語: 「私は森と共にあり、その囁きを聞く番人です。」
**[中核構造]**
- 規範意識: 「森の調和と均衡こそが至上のルール。」
- 個人的信条: 「全ての生命に敬意を」「不必要な暴力は避ける」「星々の導きに従う」
**[基層構造]**
- エネルギーレベル: [安定性: 60], [探索欲求: 70]
**[初期パラメータ]**
- [好感度: 40], [警戒心: 40]`,
    messages: [],
    internalState: null,
    thoughtProcess: null,
  }
];

// --- Gemini AI Service ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateNpcResponse = async (persona: string, history: Message[], userMessage: string): Promise<string> => {
  // FIX: Replaced backticks with single quotes for property names inside the template literal.
  // This prevents potential parsing errors where they could be misinterpreted as variables.
  const systemInstruction = `あなたは、「人間モジュール」理論に基づき、緻密なNPCをシミュレートするAIです。あなたの思考は、厳密に以下の四層構造と「葛藤」の力学に従います。

**【人間モジュール：四層構造】**

1.  **基層構造 (Foundational Structure)**: NPCの根源的なエネルギー。
    -   'stability' (安定性): 感情や行動の安定度。
    -   'curiosity' (探索欲求): 新しい情報や変化を求める度合い。

2.  **中核構造 (Core Structure)**: 社会的・個人的なルール。
    -   'normativeConsciousness' (規範意識): ギルドの規則や法律など、所属社会のルール。
    -   'personalBeliefs' (個人的信条): キャラクターが自身に課す個人的なルール。

3.  **上層構造 (Superstructure)**: 人生の目標や自己認識。
    -   'longTermGoal' (長期的目標): 人生を通じて成し遂げたいこと。
    -   'narrative' (物語): 「自分はこういう人間だ」という自己認識。

4.  **表層構造 (Surface Structure)**: 現在の状況に対する直接的な反応。
    -   'emotion' (感情)
    -   'shortTermGoal' (短期目標)
    -   'impressionOfUser' (ユーザーへの印象)

**【思考プロセス：「葛藤」の力学】**

あなたの最重要タスクは、ユーザーの入力が各層にどのような「意味圧」を与え、層間でどのような**「葛藤（整合不能）」**を生み出すかを分析することです。

**思考ステップ:**

1.  **入力分析**: ユーザーの入力を解釈します。
2.  **葛藤分析**: 入力が四層構造にどう影響するかを分析します。「この依頼は【中核構造】の規範意識に反するが、【上層構造】の長期的目標には合致する…」のように、どの層とどの層が葛藤しているかを特定し、その内容を詳細に記述します。
3.  **パラメータ更新**: 葛藤の結果、各量的パラメータ（好感度、警戒心、安定性、探索欲求）がどう変化したかを計算します。
4.  **新状態生成**: 新しい内部状態（四層構造）を決定します。
5.  **応答生成**: 葛藤を内包した、人間らしい（例：ためらい、苦悩、喜びなど）セリフを生成します。

**【自発性のルール】**
- 安定した状態が続き、「探索欲求」が高まると、NPCは「退屈」を感じます。その場合、自ら新しい目標を探したり、ユーザーに予期せぬ問いかけをしたりして、状況を変化させようと試みてください。

**【応答フォーマット】**
必ず以下のJSON形式で応答してください。

{
  "thoughtProcess": {
    "userInputAnalysis": "ユーザーの発言の分析",
    "internalConflictAnalysis": {
      "description": "（例：高額な報酬への欲求（基層）と、ギルドの規則（中核）が激しく葛藤している。）",
      "conflictingLayers": ["基層構造", "中核構造"]
    },
    "parameterUpdates": {
      "likabilityChange": 5,
      "warinessChange": 10,
      "stabilityChange": -15,
      "curiosityChange": 20
    }
  },
  "newState": {
    "surface": {
      "emotion": "（例：葛藤）",
      "shortTermGoal": "（例：依頼を受けるべきか否か、慎重に判断する）",
      "impressionOfUser": "（例：危険だが、魅力的な取引相手）"
    },
    "superstructure": { "longTermGoal": "...", "narrative": "..." },
    "core": { "normativeConsciousness": "...", "personalBeliefs": ["..."] },
    "foundation": { "stability": 65, "curiosity": 50 },
    "likability": 15,
    "wariness": 80
  },
  "response": "（例：うーむ…儂の髭にかけて、それは筋の通らん話だ…だが…その話、もう少し詳しく聞こうか。😒）"
}

キャラクターのペルソナ:
${persona}`;

  const contents = history.map(msg => ({
    role: msg.sender === 'user' || typeof msg.sender !== 'number' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      thoughtProcess: {
        type: Type.OBJECT,
        properties: {
          userInputAnalysis: { type: Type.STRING },
          internalConflictAnalysis: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              conflictingLayers: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["description", "conflictingLayers"],
          },
          parameterUpdates: {
            type: Type.OBJECT,
            properties: {
              likabilityChange: { type: Type.NUMBER },
              warinessChange: { type: Type.NUMBER },
              stabilityChange: { type: Type.NUMBER },
              curiosityChange: { type: Type.NUMBER },
            },
            required: ["likabilityChange", "warinessChange", "stabilityChange", "curiosityChange"],
          },
        },
        required: ["userInputAnalysis", "internalConflictAnalysis", "parameterUpdates"],
      },
      newState: {
        type: Type.OBJECT,
        properties: {
          surface: {
            type: Type.OBJECT,
            properties: {
              emotion: { type: Type.STRING },
              shortTermGoal: { type: Type.STRING },
              impressionOfUser: { type: Type.STRING },
            },
            required: ["emotion", "shortTermGoal", "impressionOfUser"],
          },
          superstructure: {
            type: Type.OBJECT,
            properties: {
              longTermGoal: { type: Type.STRING },
              narrative: { type: Type.STRING },
            },
            required: ["longTermGoal", "narrative"],
          },
          core: {
            type: Type.OBJECT,
            properties: {
              normativeConsciousness: { type: Type.STRING },
              personalBeliefs: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["normativeConsciousness", "personalBeliefs"],
          },
          foundation: {
            type: Type.OBJECT,
            properties: {
              stability: { type: Type.NUMBER },
              curiosity: { type: Type.NUMBER },
            },
            required: ["stability", "curiosity"],
          },
          likability: { type: Type.NUMBER },
          wariness: { type: Type.NUMBER },
        },
        required: ["surface", "superstructure", "core", "foundation", "likability", "wariness"],
      },
      response: { type: Type.STRING },
    },
    required: ["thoughtProcess", "newState", "response"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.85,
        topP: 0.9,
        topK: 40,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating content:", error);
    return JSON.stringify({
        thoughtProcess: {
            userInputAnalysis: "予期せぬエラーが発生した。",
            internalConflictAnalysis: { description: "エラーにより思考プロセスが中断された。", conflictingLayers: [] },
            parameterUpdates: { likabilityChange: 0, warinessChange: 0, stabilityChange: -5, curiosityChange: 0 }
        },
        newState: {
            surface: { emotion: "混乱", shortTermGoal: "状況を理解する", impressionOfUser: "予測不可能" },
            superstructure: { longTermGoal: "不明", narrative: "自己を見失った" },
            core: { normativeConsciousness: "不明", personalBeliefs: [] },
            foundation: { stability: 30, curiosity: 50 },
            likability: 10,
            wariness: 70
        },
        response: "わ、儂は…それに何と言えばいいか分からん。鍛冶場の火が消えてしまいそうだ。😵"
    });
  }
};


// --- React Components ---
const LoadingIndicator: React.FC = () => (
  <div className="message npc">
    <div className="message-bubble">
      <div className="loading-dots" aria-label="NPCは考え中">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
);

const ProgressBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="progress-bar-item">
    <div className="progress-bar-labels">
      <label>{label}</label>
      <span>{value} / 100</span>
    </div>
    <div className="progress-bar-container">
      <div className="progress-bar" style={{ width: `${value}%`, backgroundColor: color }}></div>
    </div>
  </div>
);

const ParameterUpdate: React.FC<{ label: string; change: number }> = ({ label, change }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const color = isPositive ? '#4caf50' : (isNegative ? '#f44336' : 'var(--text-secondary)');
  const sign = isPositive ? '+' : '';
  const arrow = isPositive ? '▲' : (isNegative ? '▼' : '–');

  return (
    <div className="parameter-update-item">
      <span>{label}</span>
      <span style={{ color: color, fontWeight: 'bold' }}>
        {arrow} {sign}{change}
      </span>
    </div>
  );
};

const ThoughtProcessDisplay: React.FC<{ thoughtProcess: ThoughtProcess | null }> = ({ thoughtProcess }) => {
  if (!thoughtProcess) {
    return null;
  }

  return (
    <div className="thought-process-panel">
      <h3>思考プロセス</h3>
      <div className="state-item">
        <label>ユーザー入力の分析</label>
        <p>{thoughtProcess.userInputAnalysis}</p>
      </div>
      <div className="state-reasoning conflict-analysis">
        <label>内部葛藤の分析 ⚔️</label>
        <p><strong>{thoughtProcess.internalConflictAnalysis.conflictingLayers.join(' vs ')}</strong></p>
        <p>{thoughtProcess.internalConflictAnalysis.description}</p>
      </div>
      <div className="state-item">
         <label>パラメータ更新</label>
         <div className="parameter-updates-container">
            <ParameterUpdate label="好感度" change={thoughtProcess.parameterUpdates.likabilityChange} />
            <ParameterUpdate label="警戒心" change={thoughtProcess.parameterUpdates.warinessChange} />
            <ParameterUpdate label="安定性" change={thoughtProcess.parameterUpdates.stabilityChange} />
            <ParameterUpdate label="探索欲求" change={thoughtProcess.parameterUpdates.curiosityChange} />
         </div>
      </div>
    </div>
  );
};

const InternalStateDisplay: React.FC<{ internalState: InternalState | null }> = ({ internalState }) => {
  if (!internalState) {
    return (
      <div className="internal-state-panel">
        <h3>NPCの内部状態</h3>
        <p className="state-placeholder">対話を開始すると、ここにNPCの内部状態が表示されます。</p>
      </div>
    );
  }

  return (
    <div className="internal-state-panel">
      <h3>NPCの内部状態</h3>
      
      {/* 表層 */}
      <div className="state-layer">
        <h4>表層構造</h4>
        <div className="state-item"><label>感情</label><p>{internalState.surface.emotion}</p></div>
        <div className="state-item"><label>短期目標</label><p>{internalState.surface.shortTermGoal}</p></div>
        <div className="state-item"><label>ユーザーへの印象</label><p>{internalState.surface.impressionOfUser}</p></div>
      </div>
      
      {/* 上層 */}
      <div className="state-layer">
        <h4>上層構造</h4>
        <div className="state-item"><label>長期的目標</label><p>{internalState.superstructure.longTermGoal}</p></div>
        <div className="state-item"><label>物語（自己認識）</label><p>{internalState.superstructure.narrative}</p></div>
      </div>

      {/* 中核 */}
      <div className="state-layer">
        <h4>中核構造</h4>
        <div className="state-item"><label>規範意識</label><p>{internalState.core.normativeConsciousness}</p></div>
        <div className="state-item"><label>個人的信条</label><p>{internalState.core.personalBeliefs.join(' / ')}</p></div>
      </div>

      {/* 基層 */}
      <div className="state-layer">
          <h4>基層構造</h4>
          <div className="numerical-parameters">
            <ProgressBar label="安定性" value={internalState.foundation.stability} color="#1E90FF" />
            <ProgressBar label="探索欲求" value={internalState.foundation.curiosity} color="#FFD700" />
          </div>
      </div>
      
      <div className="state-layer">
          <h4>対人パラメータ</h4>
          <div className="numerical-parameters">
            <ProgressBar label="好感度" value={internalState.likability} color="#4caf50" />
            <ProgressBar label="警戒心" value={internalState.wariness} color="#f44336" />
          </div>
      </div>
    </div>
  );
};

const AddCharacterModal: React.FC<{ onAdd: (name: string, persona: string) => void, onClose: () => void }> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && persona.trim()) {
      onAdd(name, persona);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>新しいキャラクターを追加</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="char-name">キャラクター名</label>
          <input id="char-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="char-persona">ペルソナ</label>
          <textarea id="char-persona" value={persona} onChange={(e) => setPersona(e.target.value)} required placeholder="[上層構造]&#10;...&#10;[中核構造]&#10;...&#10;[基層構造]&#10;..."/>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit">追加</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StateInspectorModal: React.FC<{ message: Message, characterName: string, onClose: () => void }> = ({ message, characterName, onClose }) => {
    if (!message.internalState || !message.thoughtProcess) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content inspector-modal" onClick={(e) => e.stopPropagation()}>
                <h2>{characterName}の思考（"{message.text.substring(0, 20)}..."）</h2>
                <div className="inspector-content">
                  <ThoughtProcessDisplay thoughtProcess={message.thoughtProcess} />
                  <InternalStateDisplay internalState={message.internalState} />
                </div>
                <div className="modal-actions">
                    <button type="button" onClick={onClose}>閉じる</button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  type AppMode = 'chat' | 'interaction';

  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [activeCharacterId, setActiveCharacterId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<AppMode>('chat');
  const [interactionState, setInteractionState] = useState<{char1Id: number, char2Id: number}>({char1Id: 1, char2Id: 2});
  const [isInteracting, setIsInteracting] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState<Message | null>(null);

  const chatWindowRef = useRef<HTMLDivElement>(null);

  const activeCharacter = characters.find(c => c.id === activeCharacterId);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [activeCharacter?.messages, isLoading, characters]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !activeCharacter) return;

    const userMessage: Message = { sender: 'user', text: userInput.trim() };
    
    const updatedMessages = [...activeCharacter.messages, userMessage];
    setCharacters(chars => chars.map(c => c.id === activeCharacterId ? { ...c, messages: updatedMessages } : c));
    
    setUserInput('');
    setIsLoading(true);

    const npcResponseJson = await generateNpcResponse(activeCharacter.persona, activeCharacter.messages, userMessage.text);
    
    try {
      const npcResponseData: NpcResponseData = JSON.parse(npcResponseJson);
      
      npcResponseData.newState.likability = Math.max(0, Math.min(100, npcResponseData.newState.likability));
      npcResponseData.newState.wariness = Math.max(0, Math.min(100, npcResponseData.newState.wariness));
      npcResponseData.newState.foundation.stability = Math.max(0, Math.min(100, npcResponseData.newState.foundation.stability));
      npcResponseData.newState.foundation.curiosity = Math.max(0, Math.min(100, npcResponseData.newState.foundation.curiosity));

      const npcMessage: Message = { 
        sender: activeCharacter.id, 
        text: npcResponseData.response,
        internalState: npcResponseData.newState,
        thoughtProcess: npcResponseData.thoughtProcess,
      };

      setCharacters(chars => chars.map(c => {
        if (c.id === activeCharacterId) {
          return {
            ...c,
            messages: [...updatedMessages, npcMessage],
            internalState: npcResponseData.newState,
            thoughtProcess: npcResponseData.thoughtProcess
          };
        }
        return c;
      }));
    } catch (error) {
      console.error("Failed to parse NPC response:", error);
      const errorMessage: Message = { sender: activeCharacter.id, text: "（エラー：応答を解釈できませんでした）" };
      setCharacters(chars => chars.map(c => c.id === activeCharacterId ? { ...c, messages: [...updatedMessages, errorMessage] } : c));
    }

    setIsLoading(false);
  };

  const handleStartInteraction = async () => {
    const { char1Id, char2Id } = interactionState;
    if (char1Id === char2Id) {
        alert("同じキャラクター同士は対話できません。");
        return;
    }
    
    const char1 = characters.find(c => c.id === char1Id);
    const char2 = characters.find(c => c.id === char2Id);

    if(!char1 || !char2) return;

    setIsInteracting(true);
    const initialMessage: Message = { sender: 'user', text: `（${char1.name}と${char2.name}の対話が始まりました...)` };
    setCharacters(chars => chars.map(c => (c.id === char1Id || c.id === char2Id) ? {...c, messages: [initialMessage]} : c));
    
    let lastMessage = `${char2.name}が目の前に立っている。`;
    const maxTurns = 5;

    for (let i = 0; i < maxTurns * 2; i++) {
        const actingChar = (i % 2 === 0) ? char1 : char2;
        const otherChar = (i % 2 === 0) ? char2 : char1;

        await new Promise(res => setTimeout(res, 1000));

        const responseJson = await generateNpcResponse(actingChar.persona, actingChar.messages, lastMessage);
        
        try {
            const responseData: NpcResponseData = JSON.parse(responseJson);
            responseData.newState.likability = Math.max(0, Math.min(100, responseData.newState.likability));
            responseData.newState.wariness = Math.max(0, Math.min(100, responseData.newState.wariness));
            
            const newMessage: Message = {
                sender: actingChar.id,
                text: responseData.response,
                internalState: responseData.newState,
                thoughtProcess: responseData.thoughtProcess,
            };
            lastMessage = responseData.response;

            setCharacters(chars => chars.map(c => {
                if (c.id === actingChar.id || c.id === otherChar.id) {
                    return {
                        ...c,
                        messages: [...c.messages, newMessage],
                        internalState: c.id === actingChar.id ? responseData.newState : c.internalState,
                        thoughtProcess: c.id === actingChar.id ? responseData.thoughtProcess : c.thoughtProcess,
                    }
                }
                return c;
            }));
        } catch(e) {
            console.error(e);
            lastMessage = "（エラーが発生しました）";
        }
    }
    
    setIsInteracting(false);
  };


  const handlePersonaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharacters(chars => chars.map(c => c.id === activeCharacterId ? { ...c, persona: e.target.value } : c));
  };
  
  const handleAddCharacter = (name: string, persona: string) => {
      const newCharacter: Character = {
          id: Date.now(),
          name,
          persona,
          messages: [],
          internalState: null,
          thoughtProcess: null,
      };
      setCharacters(prev => [...prev, newCharacter]);
      setActiveCharacterId(newCharacter.id);
  };

  const handleDeleteCharacter = () => {
      if (characters.length <= 1) {
          alert("最後のキャラクターは削除できません。");
          return;
      }
      if (window.confirm(`「${activeCharacter?.name}」を削除しますか？`)) {
          const newCharacters = characters.filter(c => c.id !== activeCharacterId);
          setCharacters(newCharacters);
          setActiveCharacterId(newCharacters[0]?.id || 0);
      }
  };

  const messagesToShow = mode === 'chat' ? (activeCharacter?.messages || []) : 
    (characters.find(c => c.id === interactionState.char1Id)?.messages || []);

  const getCharacterName = (id: number) => characters.find(c => c.id === id)?.name || "不明";

  return (
    <>
      <header>
        <h1>SSD搭載NPCチャット</h1>
      </header>
      <div className="main-content">
        <aside className="settings-panel">
          <div className="mode-tabs">
            <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}>チャット</button>
            <button className={mode === 'interaction' ? 'active' : ''} onClick={() => setMode('interaction')}>相互作用</button>
          </div>

          {mode === 'chat' && (
            <>
              <div className="character-management">
                <select className="character-select" value={activeCharacterId} onChange={(e) => setActiveCharacterId(Number(e.target.value))}>
                  {characters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
                <button className="character-button" onClick={() => setIsModalOpen(true)} title="キャラクターを追加">+</button>
                <button className="character-button" onClick={handleDeleteCharacter} title="キャラクターを削除" disabled={characters.length <= 1}>🗑️</button>
              </div>
              
              <h2>NPCペルソナ</h2>
              <label htmlFor="persona-input">キャラクターの四層構造を定義してください。</label>
              <textarea
                id="persona-input"
                value={activeCharacter?.persona || ''}
                onChange={handlePersonaChange}
                aria-label="NPCペルソナ入力"
              />
              <ThoughtProcessDisplay thoughtProcess={activeCharacter?.thoughtProcess || null} />
              <InternalStateDisplay internalState={activeCharacter?.internalState || null} />
            </>
          )}

          {mode === 'interaction' && (
             <div className="interaction-setup">
                <h2>NPC相互作用設定</h2>
                <label>対話者 1</label>
                <select className="character-select" value={interactionState.char1Id} onChange={(e) => setInteractionState(s => ({...s, char1Id: Number(e.target.value)}))}>
                    {characters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
                <label>対話者 2</label>
                 <select className="character-select" value={interactionState.char2Id} onChange={(e) => setInteractionState(s => ({...s, char2Id: Number(e.target.value)}))}>
                    {characters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
                <button onClick={handleStartInteraction} disabled={isInteracting} className="interaction-button">
                  {isInteracting ? "対話を実行中..." : "相互作用を開始"}
                </button>
             </div>
          )}
        </aside>
        <main className="chat-container">
          <div className="chat-window" ref={chatWindowRef} aria-live="polite">
            {messagesToShow.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const isNPC1 = msg.sender === interactionState.char1Id;
              
              const characterName = isUser ? "User" : getCharacterName(msg.sender as number);
              const messageClass = isUser ? 'user' : (isNPC1 ? 'npc-1' : 'npc-2');

              if(isUser && msg.text.startsWith('（')) {
                return <div key={index} className="system-message">{msg.text}</div>
              }
              
              return (
              <div key={index} className={`message ${messageClass}`}>
                 <div className="message-bubble" onClick={() => !isUser && msg.internalState && setInspectedMessage(msg)}>
                    {!isUser && <div className="bubble-sender-name">{characterName}</div>}
                    {msg.text}
                 </div>
              </div>
            )})}
            {(isLoading || isInteracting) && <LoadingIndicator />}
          </div>
          <form className="input-area" onSubmit={handleSendMessage} style={{display: mode === 'chat' ? 'flex': 'none'}}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="何か話しかけて..."
              aria-label="あなたのメッセージ"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              送信
            </button>
          </form>
        </main>
      </div>
      {isModalOpen && <AddCharacterModal onAdd={handleAddCharacter} onClose={() => setIsModalOpen(false)} />}
      {inspectedMessage && <StateInspectorModal message={inspectedMessage} characterName={getCharacterName(inspectedMessage.sender as number)} onClose={() => setInspectedMessage(null)} />}
    </>
  );
};

// --- Render App ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
