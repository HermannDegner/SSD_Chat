import React from 'react';
import { ThoughtProcess, InternalState } from '../types';

export const ProgressBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
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

export const ParameterUpdate: React.FC<{ label: string; change: number }> = ({ label, change }) => {
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

export const ThoughtProcessDisplay: React.FC<{ thoughtProcess: ThoughtProcess | null }> = ({ thoughtProcess }) => {
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

export const InternalStateDisplay: React.FC<{ internalState: InternalState | null }> = ({ internalState }) => {
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
