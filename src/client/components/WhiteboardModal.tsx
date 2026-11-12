import React from 'react';
import type { SwarmBoardMessage } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface WhiteboardModalProps {
  companyName: string;
  swarmTitle?: string;
  messages: SwarmBoardMessage[];
  onClose: () => void;
}

function renderMessageText(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={idx} className="mention-chip">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  companyName,
  swarmTitle,
  messages,
  onClose,
}) => {
  const { t } = useI18n();

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 10 }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            borderBottom: '2px solid #0a0c14',
            paddingBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.whiteboardModal.title}
            </span>
            <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
              {companyName}
            </span>
            {swarmTitle && (
              <span className="pixel-badge" style={{ color: '#e2d1ff' }}>
                {swarmTitle}
              </span>
            )}
            <span className="pixel-badge" style={{ color: '#3be87a' }}>
              ● {messages.length} {t.whiteboardModal.messagesCount}
            </span>
          </div>

          <button
            type="button"
            className="pixel-btn danger"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.whiteboardModal.close}
          </button>
        </div>

        {/* Messages Feed */}
        <div
          className="pixel-panel-inset"
          style={{
            flex: 1,
            minHeight: 280,
            maxHeight: 460,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
              {t.whiteboardModal.empty}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={`${msg.seq}-${msg.time}`}
                style={{
                  padding: '8px 10px',
                  background: '#171c2b',
                  border: '1px solid #2d3654',
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="pixel-badge" style={{ color: '#ffd147' }}>
                      #{msg.seq}
                    </span>
                    <span
                      className="pixel-badge"
                      style={{
                        color: msg.agent === 'coordinator' ? '#ffd147' : '#3cd8ff',
                        background: '#222940',
                      }}
                    >
                      {msg.agent}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{msg.time}</span>
                </div>
                <div style={{ color: '#eef2fc', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {renderMessageText(msg.text)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
