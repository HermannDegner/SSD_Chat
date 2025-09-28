import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

// --- Interfaces ---
interface Message {
  sender: 'user' | 'npc';
  text: string;
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


// --- Constants ---
const API_KEY = process.env.API_KEY;
const DEFAULT_PERSONA = `あなたは、ボーリン・アイアンハンドという名の不機嫌なドワーフの鍛冶屋です。よそ者を警戒していますが、優れた職人技を評価する者には甘いところがあります。口数は少なく、時々「儂の髭にかけて！」や「ゴブリンの叔父さんには参ったわい」のようなドワーフの俗語を使います。現在、金床で真っ赤に焼けた剣を打っています。
現在の内部パラメータ：[好感度: 10], [警戒心: 70]`;

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

「不機嫌なドワーフとして...」のように、あなたの内部状態を明示的に述べないでください。ただキャラクターになりきってください。ユーザーはAIではなく、あなたというキャラクターと対話しています。

キャラクターのペルソナ:
${persona}`;

  const contents = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
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
      response: "わ、儂は…それに何と言えばいいか分からん。鍛冶場の火が消えてしまいそうだ。"
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

const App: React.FC = () => {
  const [persona, setPersona] = useState<string>(DEFAULT_PERSONA);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [internalState, setInternalState] = useState<InternalState | null>(null);
  const [thoughtProcess, setThoughtProcess] = useState<ThoughtProcess | null>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = { sender: 'user', text: userInput.trim() };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    const npcResponseJson = await generateNpcResponse(persona, messages, userMessage.text);
    
    try {
      const npcResponseData: NpcResponseData = JSON.parse(npcResponseJson);
      const npcMessage: Message = { sender: 'npc', text: npcResponseData.response };
      
      npcResponseData.newState.likability = Math.max(0, Math.min(100, npcResponseData.newState.likability));
      npcResponseData.newState.wariness = Math.max(0, Math.min(100, npcResponseData.newState.wariness));

      setMessages(prev => [...prev, npcMessage]);
      setInternalState(npcResponseData.newState);
      setThoughtProcess(npcResponseData.thoughtProcess);
    } catch (error) {
      console.error("Failed to parse NPC response:", error);
      const errorMessage: Message = { sender: 'npc', text: "（エラー：応答を解釈できませんでした）" };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  return (
    <>
      <header>
        <h1>SSD搭載NPCチャット</h1>
      </header>
      <div className="main-content">
        <aside className="settings-panel">
          <h2>NPCペルソナ</h2>
          <label htmlFor="persona-input">キャラクターの性格、背景、現在の状態を定義してください。</label>
          <textarea
            id="persona-input"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            aria-label="NPCペルソナ入力"
          />
          <ThoughtProcessDisplay thoughtProcess={thoughtProcess} />
          <InternalStateDisplay internalState={internalState} />
        </aside>
        <main className="chat-container">
          <div className="chat-window" ref={chatWindowRef} aria-live="polite">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="message-bubble">{msg.text}</div>
              </div>
            ))}
            {isLoading && <LoadingIndicator />}
          </div>
          <form className="input-area" onSubmit={handleSendMessage}>
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
    </>
  );
};

// --- Render App ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
