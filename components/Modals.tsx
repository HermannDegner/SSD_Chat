import React, { useState } from 'react';
import { Character, Message } from '../types';
import { ThoughtProcessDisplay, InternalStateDisplay } from './StateDisplays';

export const AddCharacterModal: React.FC<{ onAdd: (name: string, persona: string) => void, onClose: () => void }> = ({ onAdd, onClose }) => {
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

export const StateInspectorModal: React.FC<{ message: Message, characterName: string, onClose: () => void }> = ({ message, characterName, onClose }) => {
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

export const InteractionSetupModal: React.FC<{
  characters: Character[];
  onStart: (char1Id: number, char2Id: number, context: string) => void;
  onClose: () => void;
}> = ({ characters, onStart, onClose }) => {
  const [char1Id, setChar1Id] = useState<number | undefined>(characters[0]?.id);
  const [char2Id, setChar2Id] = useState<number | undefined>(characters[1]?.id);
  const [context, setContext] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (char1Id && char2Id && char1Id !== char2Id) {
      onStart(char1Id, char2Id, context);
    } else {
      alert("異なるキャラクターを2人選択してください。");
    }
  };
  
  const availableForChar2 = characters.filter(c => c.id !== char1Id);
  const availableForChar1 = characters.filter(c => c.id !== char2Id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>NPC相互作用の設定</h2>
        <form onSubmit={handleSubmit}>
          <p>対話するキャラクター2人と、会話が開始される状況を設定してください。</p>
          
          <div className="character-selectors">
            <div className="selector-group">
                <label htmlFor="char1-select">キャラクター1</label>
                <select id="char1-select" value={char1Id} onChange={(e) => setChar1Id(Number(e.target.value))}>
                {availableForChar1.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
            </div>
            <div className="selector-group">
                <label htmlFor="char2-select">キャラクター2</label>
                <select id="char2-select" value={char2Id} onChange={(e) => setChar2Id(Number(e.target.value))}>
                {availableForChar2.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
            </div>
          </div>

          <label htmlFor="interaction-context">会話の状況設定</label>
          <textarea 
            id="interaction-context" 
            value={context} 
            onChange={(e) => setContext(e.target.value)} 
            placeholder="例：二人は酒場で偶然出会った。&#10;例：森の中で道に迷い、途方に暮れているところに出会う。"
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" disabled={!char1Id || !char2Id || char1Id === char2Id}>相互作用を開始</button>
          </div>
        </form>
      </div>
    </div>
  );
};
