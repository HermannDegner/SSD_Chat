import React from 'react';

export const LoadingIndicator: React.FC = () => (
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
