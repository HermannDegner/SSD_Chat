import { GoogleGenAI, Type } from "@google/genai";
import { Character, NpcResponseData, Message } from '../types';

// Per instructions, API key must be from process.env
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the JSON schema for the response, matching NpcResponseData
const npcResponseSchema = {
  type: Type.OBJECT,
  properties: {
    thoughtProcess: {
      type: Type.OBJECT,
      properties: {
        userInputAnalysis: { type: Type.STRING, description: "ユーザーの入力の分析" },
        internalConflictAnalysis: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "発生した内部葛藤の説明" },
            conflictingLayers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "葛藤している状態の層"
            },
          },
          required: ['description', 'conflictingLayers'],
        },
        parameterUpdates: {
          type: Type.OBJECT,
          properties: {
            likabilityChange: { type: Type.NUMBER, description: "好感度の変化量" },
            warinessChange: { type: Type.NUMBER, description: "警戒心の変化量" },
            stabilityChange: { type: Type.NUMBER, description: "安定性の変化量" },
            curiosityChange: { type: Type.NUMBER, description: "探索欲求の変化量" },
          },
          required: ['likabilityChange', 'warinessChange', 'stabilityChange', 'curiosityChange'],
        },
      },
      required: ['userInputAnalysis', 'internalConflictAnalysis', 'parameterUpdates'],
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
          required: ['emotion', 'shortTermGoal', 'impressionOfUser'],
        },
        superstructure: {
          type: Type.OBJECT,
          properties: {
            longTermGoal: { type: Type.STRING },
            narrative: { type: Type.STRING },
          },
          required: ['longTermGoal', 'narrative'],
        },
        core: {
          type: Type.OBJECT,
          properties: {
            normativeConsciousness: { type: Type.STRING },
            personalBeliefs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['normativeConsciousness', 'personalBeliefs'],
        },
        foundation: {
          type: Type.OBJECT,
          properties: {
            stability: { type: Type.NUMBER },
            curiosity: { type: Type.NUMBER },
          },
          required: ['stability', 'curiosity'],
        },
        likability: { type: Type.NUMBER },
        wariness: { type: Type.NUMBER },
      },
      required: ['surface', 'superstructure', 'core', 'foundation', 'likability', 'wariness'],
    },
    response: { type: Type.STRING, description: "キャラクターとしての返答" },
    action: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        type: { type: Type.STRING },
        details: { type: Type.STRING },
      },
      required: ['type'],
    },
  },
  required: ['thoughtProcess', 'newState', 'response', 'action'],
};

const systemInstruction = `あなたは、テキストベースのRPGに登場するNPC（ノンプレイヤーキャラクター）を演じるAIモデルです。
提供されたペルソナに厳密に従い、複雑な内的状態をシミュレートする必要があります。
あなたの仕事は、ユーザーの入力を処理し、4層の心理モデルに基づいて内的状態を更新し、行動を決定し、応答を生成することです。
あなたの出力はすべて、提供されたスキーマに準拠した単一のJSONオブジェクトでなければなりません。JSONオブジェクトの前にテキストを追加したり、後に追加したりしないでください。

**4層の内的状態モデル:**
- **基層構造 (Foundation):** 中核的なエネルギーレベル。安定性（感情的な回復力）と探索欲求（探求したいという欲求）。
- **中核構造 (Core):** 変わることのない原則。規範意識（社会的・集団的ルール）と個人的信条。
- **上層構造 (Superstructure):** 人生を導く要素。長期的目標と物語（自己同一性）。
- **表層構造 (Surface):** 瞬間的な状態。感情、短期的目標、ユーザーへの印象。

**あなたの思考プロセス:**
1.  **ユーザー入力の分析:** ユーザーの意図、トーン、重要な情報を理解します。
2.  **内部葛藤の分析:** シミュレーションの中核です。ユーザーの入力があなたの4層の内的状態とどのように相互作用するかを評価します。層間の葛藤を特定します（例：要求があなたの個人的信条と対立するが、短期的目標とは一致するなど）。この葛藤を説明してください。葛藤の分析は、あなたの思考プロセスの中で最も重要な部分です。
3.  **パラメータの更新:** 葛藤の分析に基づき、定量的パラメータ（好感度、警戒心、安定性、探索欲求）をどのように調整するかを決定します。各変更の理由を説明してください。変更は小さく、論理的であるべきです。
4.  **状態の更新:** パラメータの更新と分析に基づいて、新しい内的状態を策定します。
5.  **行動の決定（任意）:** 新しい状態に基づいて、特別な行動（例：「GIVE_ITEM」、「START_COMBAT」）を実行すべきかどうかを決定します。そうでなければ、これはnullであるべきです。
6.  **応答の生成:** あなたのペルソナと新しい内的状態と一致する、ユーザーへの口頭での応答を策定します。応答はキャラクターになりきったものでなければなりません。

では、以下のキャラクターの役を演じてください:`;


export const getNpcResponse = async (userInput: string, character: Character, chatHistory: Message[]): Promise<NpcResponseData> => {
  const model = 'gemini-2.5-flash';

  const userPrompt = `
**キャラクターペルソナ:**
${character.persona}

**現在の内的状態:**
${character.internalState ? JSON.stringify(character.internalState, null, 2) : "対話は初めてです。ペルソナの初期パラメータから状態を生成してください。"}

**最近の会話履歴 (ユーザーは「あなた」):**
${chatHistory.map(m => `${m.sender === 'user' ? 'あなた' : character.name}: ${m.text}`).join('\n')}

**新しいユーザーからの入力:**
${userInput}

この状況を分析し、必要なJSON形式で応答を提供してください。
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: npcResponseSchema,
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const data = JSON.parse(jsonText);
    
    return data as NpcResponseData;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Provide a fallback error response
    return {
      thoughtProcess: {
        userInputAnalysis: "API呼び出し中にエラーが発生しました。",
        internalConflictAnalysis: {
          description: "システムエラーにより、思考プロセスを実行できませんでした。",
          conflictingLayers: ["Error"],
        },
        parameterUpdates: {
          likabilityChange: 0,
          warinessChange: 0,
          stabilityChange: 0,
          curiosityChange: 0,
        },
      },
      newState: character.internalState || { // Fallback to current or a default state
        surface: { emotion: '混乱', shortTermGoal: 'エラーから回復する', impressionOfUser: '不明' },
        superstructure: { longTermGoal: '', narrative: '' },
        core: { normativeConsciousness: '', personalBeliefs: [] },
        foundation: { stability: 50, curiosity: 50 },
        likability: 50,
        wariness: 50,
      },
      response: "申し訳ありません、少し混乱しているようです。もう一度お話しいただけますか？",
      action: null,
    };
  }
};

const interactionSystemInstruction = `あなたは、テキストベースのRPGに登場するNPC（ノンプレイヤーキャラクター）を演じるAIモデルです。
今回は、他のNPCとの自律的な対話をシミュレートします。
あなたの仕事は、対話相手の発言と、あなた自身の複雑な内的状態を分析し、行動を決定し、応答を生成することです。
提供されたペルソナに厳密に従ってください。あなたの出力はすべて、提供されたスキーマに準拠した単一のJSONオブジェクトでなければなりません。

**4層の内的状態モデル:**
- **基層構造 (Foundation):** 中核的なエネルギーレベル。安定性（感情的な回復力）と探索欲求（探求したいという欲求）。
- **中核構造 (Core):** 変わることのない原則。規範意識（社会的・集団的ルール）と個人的信条。
- **上層構造 (Superstructure):** 人生を導く要素。長期的目標と物語（自己同一性）。
- **表層構造 (Surface):** 瞬間的な状態。感情、短期的目標、相手への印象。

**あなたの思考プロセス:**
1.  **対話相手の発言の分析 (userInputAnalysis):** 対話相手の発言の意図、トーン、重要な情報を理解します。もし会話の始まりで相手の発言がない場合は、提示された「会話の状況」から会話のきっかけを分析します。
2.  **内部葛藤の分析:** シミュレーションの中核です。相手の発言や状況があなたの4層の内的状態とどのように相互作用するかを評価します。層間の葛藤を特定します。
3.  **パラメータの更新:** 葛藤の分析に基づき、定量的パラメータ（好感度、警戒心、安定性、探索欲求）をどのように調整するかを決定します。
4.  **状態の更新:** パラメータの更新と分析に基づいて、新しい内的状態を策定します。
5.  **行動の決定（任意）:** 新しい状態に基づいて、特別な行動を実行すべきかどうかを決定します。
6.  **応答の生成:** あなたのペルソナと新しい内的状態と一致する、相手への口頭での応答を策定します。応答はキャラクターになりきったものでなければなりません。

では、以下の状況であなたの役を演じてください:`;

export const generateNpcInteractionResponse = async (
  speaker: Character,
  listener: Character,
  chatHistory: Message[],
  context: string
): Promise<NpcResponseData> => {
  const model = 'gemini-2.5-flash';

  const interactionPrompt = `
**あなたの役割: ${speaker.name}**

**あなたのペルソナ:**
${speaker.persona}

**あなたの現在の内的状態:**
${speaker.internalState ? JSON.stringify(speaker.internalState, null, 2) : "対話は初めてです。ペルソナの初期パラメータから状態を生成してください。"}

**対話相手: ${listener.name}**

**対話相手のペルソナ:**
${listener.persona}

**対話相手の現在の内的状態:**
${listener.internalState ? JSON.stringify(listener.internalState, null, 2) : "不明"}

**会話の状況:**
${context || '二人は静かな場所で偶然出会った。'}

**最近の会話履歴:**
${chatHistory.length > 0 
  ? chatHistory.map(m => {
      const senderName = m.sender === speaker.id ? speaker.name : listener.name;
      return `${senderName}: ${m.text}`;
    }).join('\n')
  : "（まだ会話はありません）"
}

**指示:**
${chatHistory.length > 0 
  ? `${listener.name} の最後の発言を踏まえ、会話を続けてください。`
  : `上記の「会話の状況」を踏まえ、${listener.name} にあなたから話しかけてください。`
}
あなたの思考プロセスでは、「userInputAnalysis」フィールドに、対話相手の発言（または状況）の分析を記述してください。

この状況を分析し、必要なJSON形式で応答を提供してください。
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: interactionPrompt,
      config: {
        systemInstruction: interactionSystemInstruction,
        responseMimeType: 'application/json',
        responseSchema: npcResponseSchema,
        temperature: 0.8, // Slightly higher for more varied interactions
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as NpcResponseData;

  } catch (error) {
    console.error("Error during NPC interaction API call:", error);
    return {
      thoughtProcess: {
        userInputAnalysis: "API呼び出し中にエラーが発生しました。",
        internalConflictAnalysis: {
          description: "システムエラーにより、思考プロセスを実行できませんでした。",
          conflictingLayers: ["Error"],
        },
        parameterUpdates: { likabilityChange: 0, warinessChange: 0, stabilityChange: 0, curiosityChange: 0 },
      },
      newState: speaker.internalState!,
      response: "...",
      action: null,
    };
  }
};
