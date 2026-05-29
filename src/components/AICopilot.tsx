import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';

type CopilotCard = {
  title: string;
  sub: string;
  value: string;
  icon: React.ReactNode;
  route?: string;
};

type CopilotMessage = {
  role: 'bot' | 'user';
  text: string;
  time: string;
  card?: CopilotCard;
};

type SennaRole = 'user' | 'assistant';

type SennaActionDraft = {
  actionType: string;
  targetRoute: string;
  summary: string;
  warnings?: string[];
};

type SennaChatResponse = {
  blocked?: boolean;
  sessionId?: string;
  answer?: string;
  actionDraft?: SennaActionDraft | null;
};

const nowTime = (): string => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const SUGGESTIONS = [
  'What launches are live?',
  'Help me create an NFT',
  'How do I lock tokens?',
  'RISE testnet setup',
];

const INTRO_MESSAGES = [
  "Hey, Senna here. What's the move?",
  "Hi, I'm Senna. What's up?",
  "Hey. Launchpad, NFTs, tokens, or chaos?",
  "Hi, Senna here. Fire away.",
];

const RESET_MESSAGES = [
  "Clean slate. What's next?",
  "Fresh lap. What are we sorting?",
  "New chat. Fire away.",
];

const SENNA_API_URL =
  (import.meta.env.VITE_SENNA_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8788';

const randomItem = (items: string[]) => items[Math.floor(Math.random() * items.length)];

const makeBotMessage = (text: string): CopilotMessage => ({
  role: 'bot',
  text,
  time: nowTime(),
});

const toApiMessages = (messages: CopilotMessage[], nextUserMessage: string) => {
  const mapped = messages.slice(-24).map((message) => ({
    role: (message.role === 'bot' ? 'assistant' : 'user') as SennaRole,
    content: message.text,
  }));

  mapped.push({ role: 'user', content: nextUserMessage });
  return mapped;
};

const buildChatPayload = (input: {
  sessionId: string | null;
  address?: string;
  chainId?: number;
  messages: Array<{ role: SennaRole; content: string }>;
}) => {
  const payload: {
    sessionId?: string;
    mode: 'fast';
    walletAddress?: string;
    evmAddress?: string;
    chainId?: number;
    messages: Array<{ role: SennaRole; content: string }>;
  } = {
    mode: 'fast',
    messages: input.messages,
  };

  if (input.sessionId) payload.sessionId = input.sessionId;
  if (input.address) {
    payload.walletAddress = input.address;
    payload.evmAddress = input.address;
  }
  if (input.chainId) payload.chainId = input.chainId;

  return payload;
};

const readApiError = async (response: Response) => {
  let detail = '';

  try {
    const data = await response.json();
    detail = data?.detail || data?.error || '';
  } catch {
    detail = await response.text().catch(() => '');
  }

  if (response.status === 429) {
    return 'Senna is rate-limiting this chat for a moment. Give it a few seconds and try again.';
  }

  return detail
    ? `Senna API returned ${response.status}: ${detail}`
    : `Senna API returned ${response.status}.`;
};

const cardForAction = (actionDraft?: SennaActionDraft | null): CopilotCard | undefined => {
  if (!actionDraft?.targetRoute) return undefined;

  return {
    title: actionDraft.summary || 'Open in Stage0',
    sub: actionDraft.targetRoute,
    value: 'Open',
    icon: 'S0',
    route: actionDraft.targetRoute,
  };
};

const AICopilot: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const chainId = useChainId();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => [makeBotMessage(randomItem(INTRO_MESSAGES))]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Update greeting when domain loads in
  useEffect(() => {
    setMessages([{ role: 'bot', text: greeting, time: nowTime() }]);
  }, [greeting]);

  useEffect(() => {
    if (chatOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [chatOpen, messages, typing]);

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer');
      if (!footer) {
        setBottomOffset(24);
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      if (footerRect.top < viewportHeight) {
        const visibleFooterHeight = viewportHeight - footerRect.top;
        setBottomOffset(visibleFooterHeight + 24);
      } else {
        setBottomOffset(24);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const openChat = () => {
    setChatOpen(true);
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([makeBotMessage(randomItem(RESET_MESSAGES))]);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;
    const nextMessages = [...messages, { role: 'user' as const, text: msg, time: nowTime() }];
    setMessages((m) => [...m, { role: 'user', text: msg, time: nowTime() }]);
    setInput('');
    setTyping(true);

    try {
      const response = await fetch(`${SENNA_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildChatPayload({
          sessionId,
          chainId,
          address,
          messages: toApiMessages(messages, msg),
        })),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as SennaChatResponse;
      if (data.sessionId) setSessionId(data.sessionId);

      setMessages([
        ...nextMessages,
        {
          role: 'bot',
          text: data.answer || 'Senna did not return an answer.',
          time: nowTime(),
          card: cardForAction(data.actionDraft),
        },
      ]);
    } catch (error) {
      const fallbackText =
        error instanceof TypeError
          ? `I cannot connect to Senna at ${SENNA_API_URL}. Confirm the local API is running, then try again.`
          : error instanceof Error
            ? error.message
            : `I cannot connect to Senna at ${SENNA_API_URL}. Confirm the local API is running, then try again.`;

      setMessages([
        ...nextMessages,
        {
          role: 'bot',
          text: fallbackText,
          time: nowTime(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="ai-bubble-wrap" style={{ bottom: `${bottomOffset}px` }}>
      {chatOpen && (
        <div className="ai-chat" role="dialog" aria-label="Senna assistant">
          <div className="ai-chat-header">
            <div className="ai-chat-avatar">S</div>
            <div>
              <div className="ai-chat-name">Senna</div>
              <div className="ai-chat-status">Online · Stage0 assistant</div>
            </div>
            <div className="ai-chat-actions">
              <button
                type="button"
                className="ai-chat-icon-btn"
                title="New chat"
                onClick={startNewChat}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
              <button
                type="button"
                className="ai-chat-icon-btn"
                title="Close"
                onClick={() => setChatOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="ai-chat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-msg-row">
                  {m.role === 'bot' && <div className="ai-msg-mini-avatar">S</div>}
                  <div style={{ minWidth: 0 }}>
                    <div className="ai-msg-bubble">{m.text}</div>
                    {m.card && (
                      <button
                        type="button"
                        className="ai-msg-card"
                        onClick={() => {
                          if (m.card?.route) {
                            setChatOpen(false);
                            navigate(m.card.route);
                          }
                        }}
                      >
                        <div className="ai-msg-card-head">
                          <div className="ai-msg-card-icon">{m.card.icon}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="ai-msg-card-title">{m.card.title}</div>
                            <div className="ai-msg-card-sub">{m.card.sub}</div>
                          </div>
                          <div className="ai-msg-card-value">{m.card.value}</div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
                <div className="ai-msg-time">{m.time}</div>
              </div>
            ))}
            {typing && (
              <div className="ai-msg bot">
                <div className="ai-msg-row">
                  <div className="ai-msg-mini-avatar">S</div>
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ai-suggests">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ai-suggest" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="ai-chat-input">
            <div className="ai-input-wrap">
              <input
                className="ai-input"
                placeholder="Ask anything about Stage0…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                disabled={typing}
              />
            </div>
            <button type="button" className="ai-send" onClick={() => send()} disabled={!input.trim() || typing} aria-label="Send message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="ai-bubble"
        onClick={() => (chatOpen ? setChatOpen(false) : openChat())}
        aria-label={chatOpen ? 'Close Senna' : 'Open Senna'}
      >
        {chatOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 1 3 3v1h1a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-1l-3 3-3-3H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4h1V5a3 3 0 0 1 3-3z" />
            <circle cx="9.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default AICopilot;
