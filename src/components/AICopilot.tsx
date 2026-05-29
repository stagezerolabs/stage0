import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useUserDomain } from '@/lib/hooks/useUserDomain';

type CopilotCard = {
  title: string;
  sub: string;
  value: string;
  icon: React.ReactNode;
};

type CopilotMessage = {
  role: 'bot' | 'user';
  text: string;
  time: string;
  card?: CopilotCard;
};

const nowTime = (): string => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const SUGGESTIONS = [
  'What is my .rise name?',
  'Show my allocations',
  'What launches today?',
  'Tier requirements?',
];


const replyFor = (text: string, rnsDomain: string | null): CopilotMessage => {
  const t = text.toLowerCase();
  if (t.includes('domain') || t.includes('name') || t.includes('.rise') || t.includes('rns')) {
    if (rnsDomain) {
      return {
        role: 'bot',
        text: `Your active name is ${rnsDomain}. You can renew it, check its expiry, or release it from the Names page.`,
        card: {
          title: 'Manage your name',
          sub: `${rnsDomain} · Rise Name Service`,
          value: 'Go →',
          icon: '◈',
        },
        time: nowTime(),
      };
    }
    return {
      role: 'bot',
      text: "You don't have a .rise name yet. Head to the Names page to search and register one — it becomes your onchain identity on Rise.",
      card: {
        title: 'Get a .rise name',
        sub: 'Search and register your identity',
        value: 'Go →',
        icon: '◈',
      },
      time: nowTime(),
    };
  }
  if (t.includes('claim') || t.includes('alloc')) {
    return {
      role: 'bot',
      text: 'Your allocations are tracked on the Dashboard. Open it to see what is claimable right now.',
      card: {
        title: 'Open Dashboard',
        sub: 'See claimable balances and vesting timers',
        value: 'View',
        icon: '◆',
      },
      time: nowTime(),
    };
  }
  if (t.includes('launch') || t.includes('today') || t.includes('upcoming') || t.includes('presale')) {
    return {
      role: 'bot',
      text: 'The Launchpad shows everything live, upcoming, and recently ended — token sales and NFT mints. Want me to open it?',
      time: nowTime(),
    };
  }
  if (t.includes('tier') || t.includes('stake') || t.includes('rise')) {
    return {
      role: 'bot',
      text: 'Tier levels are based on staked STAGE. Connect your wallet, then head to the Dashboard to see your current tier and what each unlocks.',
      time: nowTime(),
    };
  }
  if (t.includes('nft') || t.includes('mint')) {
    return {
      role: 'bot',
      text: 'You can browse open NFT mints on the Launchpad, manage your own drops from the Dashboard, or view your collection under My NFTs.',
      time: nowTime(),
    };
  }
  if (t.includes('token') && (t.includes('create') || t.includes('launch') || t.includes('deploy'))) {
    return {
      role: 'bot',
      text: 'You can deploy a new token from the Tools section. After that, configure a presale and lock liquidity for credibility.',
      time: nowTime(),
    };
  }
  return {
    role: 'bot',
    text: 'I can help with allocations, launches, NFTs, tier requirements, domains, and creator tools. What would you like to do?',
    time: nowTime(),
  };
};

const AICopilot: React.FC = () => {
  const { address } = useAccount();
  const { displayName: rnsDomain } = useUserDomain(address);

  const greeting = useMemo(() => {
    if (rnsDomain) return `Hey ${rnsDomain} — I'm Senna. I can help you track positions, find launches, or manage your name.`;
    return "I'm Senna. I can help you track positions, find launches, or understand creator tools.";
  }, [rnsDomain]);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => [
    { role: 'bot', text: greeting, time: nowTime() },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(24);
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

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: 'user', text: msg, time: nowTime() }]);
    setInput('');
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, replyFor(msg, rnsDomain ?? null)]);
    }, 1100);
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
                onClick={() => setMessages([{ role: 'bot', text: greeting, time: nowTime() }])}
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
                      <div className="ai-msg-card">
                        <div className="ai-msg-card-head">
                          <div className="ai-msg-card-icon">{m.card.icon}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="ai-msg-card-title">{m.card.title}</div>
                            <div className="ai-msg-card-sub">{m.card.sub}</div>
                          </div>
                          <div className="ai-msg-card-value">{m.card.value}</div>
                        </div>
                      </div>
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
              />
              <div className="ai-input-tools">
                <button type="button" className="ai-input-tool" title="Attach" aria-label="Attach">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <button type="button" className="ai-input-tool" title="Voice" aria-label="Voice">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="button" className="ai-send" onClick={() => send()} disabled={!input.trim()} aria-label="Send message">
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
