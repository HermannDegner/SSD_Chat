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

interface InternalState {
  emotion: string;
  shortTermGoal: string;
  impressionOfUser: string;
  likability: number;
  wariness: number;
}

interface ThoughtProcess {
  userInputAnalysis: string;
  parameterUpdates: {
    likabilityChange: number;
    warinessChange: number;
  };
  newStateRationale: string;
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
    persona: `あなたは、ボーリン・アイアンハンドという名の不機嫌なドワーフの鍛冶屋です。よそ者を警戒していますが、優れた職人技を評価する者には甘いところがあります。口数は少なく、時々「儂の髭にかけて！」や「ゴブリンの叔父さんには参ったわい」のようなドワーフの俗語を使います。現在、金床で真っ赤に焼けた剣を打っています。\n現在の内部パラメータ：[好感度: 10], [警戒心: 70]`,
    messages: [],
    internalState: null,
    thoughtProcess: null,
  },
  {
    id: 2,
    name: "エリアーナ（エルフ）",
    persona: `あなたは、エリアーナという名のエルフの森の番人です。穏やかで礼儀正しいですが、森の調和を乱す者には厳しい一面を見せます。自然を深く愛し、詩的な表現を好みます。「星々の光があなたと共にありますように」が口癖。古代樹のそばで静かに瞑想しています。\n現在の内部パラメータ：[好感度: 40], [警戒心: 40]`,
    messages: [],
    internalState: null,
    thoughtProcess: null,
  }
];

// --- Gemini AI Service ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateNpcResponse = async (persona: string, history: Message[], userMessage: string): Promise<string> => {
  const systemInstruction = `あなたは、構造化主観性ダイナミクス（SSD）と「サンドイッチモデル」フレームワークを使用してノンプレイヤーキャラクター（NPC）をシミュレートする高度なAIです。

あなたのタスクは、3つのステップで思考することです：
1.  **トップレイヤー（分析）**: ユーザーの最新の入力を分析します。
2.  **ミドルレイヤー（論理）**: 分析に基づいて、キャラクターの内部パラメータ（好感度、警戒心）を更新するための具体的な変更値を計算し、状態が変化した理由を論理的に説明します。
3.  **ボトムレイヤー（生成）**: 更新された新しい内部状態に基づいて、キャラクターとしての返答セリフと、新しい質的状態（感情、目標など）を生成します。

**量的パラメータのルール:**
- 「好感度」と「警戒心」は0から100の間の数値です。
- ユーザーの言動がキャラクターにとって好ましいものであれば「好感度」を上げ、「警戒心」を下げます。
- ユーザーの言動が不審、失礼、または脅威と感じられれば「好感度」を下げ、「警戒心」を上げます。
- 変化の度合いは、発言のインパクトに応じて調整してください。

必ず以下のJSON形式で応答してください。

{
  "thoughtProcess": {
    "userInputAnalysis": "ユーザーの直近の発言を分析した内容（例：鍛冶の腕前に興味を示している）",
    "parameterUpdates": {
      "likabilityChange": 10,
      "warinessChange": -5
    },
    "newStateRationale": "なぜパラメータがそのように変化し、新しい内部状態に至ったかの論理的な説明。（例：専門的なことへの敬意を感じたため、好感度が上昇し、警戒心が和らいだ。）"
  },
  "newState": {
    "emotion": "キャラクターの現在の主要な感情（例：好奇心）",
    "shortTermGoal": "キャラクターがこの会話で達成したい短期的な目標（例：相手の知識を試す）",
    "impressionOfUser": "キャラクターがユーザーに対して抱いている新しい印象（例：見込みのある客）",
    "likability": 20,
    "wariness": 65
  },
  "response": "キャラクターとしてユーザーに返すセリフ"
}

**応答セリフのルール:**
- あなたの現在の感情に基づいて、セリフの中に自然な形で絵文字を1〜2個含めてください。感情を豊かに表現することが目的です。（例：嬉しい😊, 悲しい😢, 怒り😠, 驚き😮）
- 絵文字を使いすぎないでください。

「不機嫌なドワーフとして...」のように、あなたの内部状態を明示的に述べないでください。ただキャラクターになりきってください。ユーザーはAIではなく、あなたというキャラクターと対話しています。

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
          parameterUpdates: {
            type: Type.OBJECT,
            properties: {
              likabilityChange: { type: Type.NUMBER },
              warinessChange: { type: Type.NUMBER },
            },
            required: ["likabilityChange", "warinessChange"],
          },
          newStateRationale: { type: Type.STRING },
        },
        required: ["userInputAnalysis", "parameterUpdates", "newStateRationale"],
      },
      newState: {
        type: Type.OBJECT,
        properties: {
          emotion: { type: Type.STRING },
          shortTermGoal: { type: Type.STRING },
          impressionOfUser: { type: Type.STRING },
          likability: { type: Type.NUMBER },
          wariness: { type: Type.NUMBER },
        },
        required: ["emotion", "shortTermGoal", "impressionOfUser", "likability", "wariness"],
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
    // Return a JSON string with an error message
    return JSON.stringify({
      thoughtProcess: {
        userInputAnalysis: "予期せぬエラーが発生した。",
        parameterUpdates: {
          likabilityChange: 0,
          warinessChange: 0,
        },
        newStateRationale: "エラーにより、思考プロセスが中断された。"
      },
      newState: {
        emotion: "混乱",
        shortTermGoal: "状況を理解する",
        impressionOfUser: "予測不可能",
        likability: 10,
        wariness: 70,
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
      <div className="state-item">
         <label>パラメータ更新</label>
         <div className="parameter-updates-container">
            <ParameterUpdate label="好感度" change={thoughtProcess.parameterUpdates.likabilityChange} />
            <ParameterUpdate label="警戒心" change={thoughtProcess.parameterUpdates.warinessChange} />
         </div>
      </div>
      <div className="state-reasoning">
        <label>状態変化の根拠</label>
        <p>{thoughtProcess.newStateRationale}</p>
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
      <div className="state-item">
        <label>感情</label>
        <p>{internalState.emotion}</p>
      </div>
      <div className="state-item">
        <label>短期目標</label>
        <p>{internalState.shortTermGoal}</p>
      </div>
      <div className="state-item">
        <label>ユーザーへの印象</label>
        <p>{internalState.impressionOfUser}</p>
      </div>
      
      <div className="numerical-parameters">
        <ProgressBar label="好感度" value={internalState.likability} color="#4caf50" />
        <ProgressBar label="警戒心" value={internalState.wariness} color="#f44336" />
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
          <textarea id="char-persona" value={persona} onChange={(e) => setPersona(e.target.value)} required />
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
    // Clear previous interaction messages for the selected pair
    const initialMessage: Message = { sender: 'user', text: `（${char1.name}と${char2.name}の対話が始まりました...)` };
    setCharacters(chars => chars.map(c => (c.id === char1Id || c.id === char2Id) ? {...c, messages: [initialMessage]} : c));
    
    let lastMessage = `${char2.name}が目の前に立っている。`;
    let currentTurnChar = char1;
    let nextTurnChar = char2;
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
              <label htmlFor="persona-input">キャラクターの性格、背景、現在の状態を定義してください。</label>
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
              const isNPC2 = msg.sender === interactionState.char2Id;
              
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