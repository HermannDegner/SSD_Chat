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
  reasonForChange: string;
}

// --- Constants ---
const API_KEY = process.env.API_KEY;
const DEFAULT_PERSONA = `あなたは、ボーリン・アイアンハンドという名の不機嫌なドワーフの鍛冶屋です。よそ者を警戒していますが、優れた職人技を評価する者には甘いところがあります。口数は少なく、時々「儂の髭にかけて！」や「ゴブリンの叔父さんには参ったわい」のようなドワーフの俗語を使います。現在、金床で真っ赤に焼けた剣を打っています。`;

// --- Gemini AI Service ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateNpcResponse = async (persona: string, history: Message[], userMessage: string): Promise<string> => {
  const systemInstruction = `あなたは、構造化主観性ダイナミクス（SSD）フレームワークを使用してノンプレイヤーキャラクター（NPC）をシミュレートする高度なAIです。
あなたのタスクは、キャラクターの現在の内部状態を分析し、その状態に基づいてキャラクターとしての返答を生成することです。

必ず以下のJSON形式で応答してください。

{
  "internalState": {
    "emotion": "キャラクターの現在の主要な感情（例：不機嫌、好奇心、苛立ち）",
    "shortTermGoal": "キャラクターがこの会話で達成したい短期的な目標（例：侵入者を追い払う、情報を得る、仕事を終える）",
    "impressionOfUser": "キャラクターがユーザーに対して抱いている印象（例：迷惑な邪魔者、潜在的な顧客、無知な若者）",
    "reasonForChange": "ユーザーの直近の発言を受けて、なぜ内部状態がこのように変化したのかを簡潔に説明します。（例：ユーザーが私の仕事に敬意を払ったため、不機嫌さが和らぎ、好奇心が湧いた。）"
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
      internalState: {
        type: Type.OBJECT,
        properties: {
          emotion: { type: Type.STRING },
          shortTermGoal: { type: Type.STRING },
          impressionOfUser: { type: Type.STRING },
          reasonForChange: { type: Type.STRING },
        },
        required: ["emotion", "shortTermGoal", "impressionOfUser", "reasonForChange"],
      },
      response: { type: Type.STRING },
    },
    required: ["internalState", "response"],
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
      internalState: {
        emotion: "混乱",
        shortTermGoal: "状況を理解する",
        impressionOfUser: "予測不可能",
        reasonForChange: "予期せぬエラーが発生し、思考が混乱した。"
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
      {internalState.reasonForChange && (
        <div className="state-reasoning">
          <label>状態変化の理由</label>
          <p>{internalState.reasonForChange}</p>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [persona, setPersona] = useState<string>(DEFAULT_PERSONA);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [internalState, setInternalState] = useState<InternalState | null>(null);
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
      const npcResponseData = JSON.parse(npcResponseJson);
      const npcMessage: Message = { sender: 'npc', text: npcResponseData.response };
      setMessages(prev => [...prev, npcMessage]);
      setInternalState(npcResponseData.internalState);
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
