import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Character, Message, NpcResponseData } from '../types';
import { DEFAULT_CHARACTERS } from '../constants';
import { getNpcResponse, generateNpcInteractionResponse } from '../services/gemini';
import { LoadingIndicator } from './LoadingIndicator';
import { InternalStateDisplay } from './StateDisplays';
import { AddCharacterModal, StateInspectorModal, InteractionSetupModal } from './Modals';

const App: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [activeCharacterId, setActiveCharacterId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAddCharModalOpen, setAddCharModalOpen] = useState<boolean>(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState<boolean>(false);
  const [inspectorMessage, setInspectorMessage] = useState<Message | null>(null);

  // NPC Interaction State
  const [isInInteraction, setIsInInteraction] = useState<boolean>(false);
  const [interactionMessages, setInteractionMessages] = useState<Message[]>([]);
  // Store IDs instead of full objects to avoid stale state in closures
  const [interactionCharIds, setInteractionCharIds] = useState<[number, number] | null>(null);
  const [interactionContext, setInteractionContext] = useState<string>('');
  const interactionTimerRef = useRef<number | null>(null);

  const activeCharacter = characters.find(c => c.id === activeCharacterId)!;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCharacter?.messages, interactionMessages, isLoading]);

  // Use a ref to hold the interaction logic. This function will be updated on every render,
  // ensuring it always has access to the latest state, avoiding the "stale closure" problem.
  const runInteractionRef = useRef<() => Promise<void>>();

  // FIX: The `useEffect` on line 35 was causing a cryptic error.
  // Assigning to a ref's `.current` property is safe to do during render.
  // This ensures the ref always holds the latest version of the function.
  runInteractionRef.current = async () => {
    if (!interactionCharIds) return;

    // Get the latest character data and messages from state on each execution
    const char1 = characters.find(c => c.id === interactionCharIds[0]);
    const char2 = characters.find(c => c.id === interactionCharIds[1]);

    if (!char1 || !char2) {
      console.error("Interacting characters not found.");
      handleStopInteraction();
      return;
    }

    const lastMessage = interactionMessages.length > 0 ? interactionMessages[interactionMessages.length - 1] : null;

    const speaker = !lastMessage || lastMessage.sender === char2.id ? char1 : char2;
    const listener = speaker.id === char1.id ? char2 : char1;

    setIsLoading(true);
    try {
      const chatHistory = interactionMessages.slice(-10);
      const data = await generateNpcInteractionResponse(speaker, listener, chatHistory, interactionContext);
      
      const newMessage: Message = {
        sender: speaker.id,
        text: data.response,
        thoughtProcess: data.thoughtProcess,
        internalState: data.newState,
        action: data.action,
      };

      setInteractionMessages(prev => [...prev, newMessage]);
      setCharacters(prevChars => 
        prevChars.map(c => 
          c.id === speaker.id 
            ? { ...c, internalState: data.newState, thoughtProcess: data.thoughtProcess } 
            : c
        )
      );
    } catch (error) {
      console.error("Interaction failed:", error);
    } finally {
      setIsLoading(false);
      // Schedule the next turn only if the interaction is still active.
      if (isInInteraction) {
          interactionTimerRef.current = window.setTimeout(() => runInteractionRef.current?.(), 5000 + Math.random() * 2000);
      }
    }
  };
  
  // Effect to manage the interaction loop START/STOP
  useEffect(() => {
    if (isInInteraction) {
      runInteractionRef.current?.();
    }
    
    return () => {
      if (interactionTimerRef.current) {
        clearTimeout(interactionTimerRef.current);
        interactionTimerRef.current = null;
      }
    };
  }, [isInInteraction]);


  const handleCharacterSelect = (id: number) => {
    if(isInInteraction) return;
    setActiveCharacterId(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || isInInteraction) return;

    const userMessage: Message = { sender: 'user', text: userInput };
    
    const currentCharacter = characters.find(c => c.id === activeCharacterId)!;
    const updatedMessages = [...currentCharacter.messages, userMessage];

    setCharacters(characters.map(char => 
      char.id === activeCharacterId 
        ? { ...char, messages: updatedMessages }
        : char
    ));
    
    const currentUserInput = userInput;
    setUserInput('');
    setIsLoading(true);

    try {
      const chatHistory = updatedMessages.slice(-10); 
      const data: NpcResponseData = await getNpcResponse(currentUserInput, currentCharacter, chatHistory);
      
      const npcMessage: Message = {
        sender: activeCharacterId,
        text: data.response,
        thoughtProcess: data.thoughtProcess,
        internalState: data.newState,
        action: data.action,
      };

      setCharacters(prevChars =>
        prevChars.map(char =>
          char.id === activeCharacterId
            ? {
                ...char,
                messages: [...char.messages, npcMessage],
                internalState: data.newState,
                thoughtProcess: data.thoughtProcess,
              }
            : char
        )
      );
    } catch (error) {
      console.error("Failed to get NPC response:", error);
      const errorMessage: Message = {
        sender: activeCharacterId,
        text: "申し訳ありません、エラーが発生しました。",
      };
      setCharacters(prevChars =>
        prevChars.map(char =>
          char.id === activeCharacterId
            ? { ...char, messages: [...char.messages, errorMessage] }
            : char
        )
      );
    } finally {
      setIsLoading(false);
    }
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
    setCharacters([...characters, newCharacter]);
  };

  const handleStartInteraction = (char1Id: number, char2Id: number, context: string) => {
    setInteractionCharIds([char1Id, char2Id]);
    setInteractionContext(context);
    setInteractionMessages([]);
    setIsInInteraction(true);
    setIsInteractionModalOpen(false);
  };

  const handleStopInteraction = () => {
    setIsInInteraction(false);
    setInteractionCharIds(null);
    setInteractionContext('');
  };
  
  const interactionCharObjects = characters.filter(c => interactionCharIds?.includes(c.id));
  const displayedMessages = isInInteraction ? interactionMessages : activeCharacter?.messages ?? [];

  return (
    <div className="app-container">
      <header>
        <h1>{isInInteraction ? 'NPC Interaction' : 'AI NPC Chat'}</h1>
        <p>{isInInteraction && interactionCharObjects.length === 2 ? `${interactionCharObjects[0].name} & ${interactionCharObjects[1].name}` : 'Gēmu-teki AI との対話'}</p>
      </header>
      <main className="main-content">
        <aside className="sidebar character-sidebar">
          <h2>キャラクター</h2>
          <button onClick={isInInteraction ? handleStopInteraction : () => setIsInteractionModalOpen(true)} disabled={characters.length < 2} className="interaction-button">
            {isInInteraction ? '相互作用を停止' : 'NPC相互作用を開始'}
          </button>
          <ul>
            {characters.map(char => (
              <li 
                key={char.id} 
                className={`${char.id === activeCharacterId && !isInInteraction ? 'active' : ''} ${isInInteraction ? 'disabled' : ''}`}
                onClick={() => handleCharacterSelect(char.id)}
              >
                {char.name}
              </li>
            ))}
          </ul>
          <button onClick={() => setAddCharModalOpen(true)} disabled={isInInteraction}>キャラクターを追加</button>
        </aside>

        <section className="chat-panel">
          <div className="chat-window">
            {displayedMessages.length === 0 && !isLoading && (
              <div className="empty-chat-placeholder">
                <p>{isInInteraction ? 'NPC同士の対話が開始されます...' : `${activeCharacter.name}との対話を開始します。`}</p>
              </div>
            )}
            {displayedMessages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender === 'user' ? 'user' : 'npc'}`}>
                 <div className="message-bubble">
                  {isInInteraction && msg.sender !== 'user' && (
                    <div className="bubble-sender-name">
                      {characters.find(c => c.id === msg.sender)?.name}
                    </div>
                  )}
                  {msg.text}
                  {msg.sender !== 'user' && msg.internalState && (
                    <button className="inspector-button" onClick={() => setInspectorMessage(msg)} title="思考プロセスを検査">
                      🧠
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && <LoadingIndicator />}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isInInteraction ? "NPCが対話中です..." : `${activeCharacter.name}に話しかける...`}
              disabled={isLoading || isInInteraction}
            />
            <button type="submit" disabled={isLoading || isInInteraction}>送信</button>
          </form>
        </section>

        <aside className="sidebar state-sidebar">
          <InternalStateDisplay internalState={activeCharacter.internalState} />
        </aside>
      </main>

      {isAddCharModalOpen && (
        <AddCharacterModal 
          onAdd={handleAddCharacter}
          onClose={() => setAddCharModalOpen(false)}
        />
      )}
      {isInteractionModalOpen && (
        <InteractionSetupModal
            characters={characters}
            onStart={handleStartInteraction}
            onClose={() => setIsInteractionModalOpen(false)}
        />
      )}
      {inspectorMessage && (
        <StateInspectorModal
          message={inspectorMessage}
          characterName={characters.find(c => c.id === inspectorMessage.sender)?.name || 'Unknown'}
          onClose={() => setInspectorMessage(null)}
        />
      )}
    </div>
  );
};

export default App;
