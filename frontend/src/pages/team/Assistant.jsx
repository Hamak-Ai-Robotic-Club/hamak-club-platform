import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, CircleAlert, Lightbulb, Plus, Send, ShieldCheck, User } from "lucide-react";
import { Api } from "../../api/client.js";
import { ComponentThumb, HackathonLogo } from "../../components/ui.jsx";

const suggestions = [
  "اقترح علينا فكرة مشروع إنترنت أشياء يمكن تنفيذها خلال الهاكاثون",
  "نريد روبوتاً يتجنب العوائق، ما القطع المتوفرة المناسبة؟",
  "كيف أقيس الحرارة والرطوبة وأرسلها عبر الواي فاي؟",
  "ما الفرق بين محرك السيرفو والمحرك الخطوي ومتى أستخدم كل منهما؟",
];

export default function Assistant({ theme, onAddMany, pendingRequest }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiEnabled, setAiEnabled] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    Api.chatStatus().then((data) => setAiEnabled(Boolean(data?.aiEnabled))).catch(() => setAiEnabled(false));
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    if (content.length > 2000) {
      setError("الرسالة طويلة جداً (2000 حرف كحد أقصى).");
      return;
    }
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const history = next.slice(-12).map(({ role, content: body }) => ({ role, content: body }));
      const result = await Api.chat(history);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.reply, recommendations: result.recommendations || [] },
      ]);
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content assistant-page">
      <section className="assistant-shell panel">
        <header className="assistant-header">
          <span className="assistant-avatar"><Bot size={22} /></span>
          <div>
            <h2>مساعد هاكاثون الهمك</h2>
            <p>استشارات تقنية، أفكار مشاريع، وتوصيات قطع من المخزون الفعلي — للقراءة والاستشارة فقط.</p>
          </div>
          <span className={`assistant-mode ${aiEnabled ? "is-ai" : ""}`}>{aiEnabled === null ? "..." : aiEnabled ? "AI مفعّل" : "بحث المخزون"}</span>
        </header>

        <div className="assistant-messages" ref={listRef} aria-live="polite">
          {!messages.length && (
            <div className="assistant-welcome">
              <HackathonLogo theme={theme} className="assistant-hack-logo" />
              <strong>كيف أساعد فريقك اليوم؟</strong>
              <span>صف فكرتك وسأبحث في مخزون النادي عن القطع المناسبة مع الكمية المتاحة الآن.</span>
              <div className="assistant-suggestions">
                {suggestions.map((text) => (
                  <button key={text} type="button" onClick={() => send(text)}><Lightbulb size={14} /> {text}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`chat-row chat-${message.role}`}>
              <span className="chat-icon">{message.role === "user" ? <User size={16} /> : <Bot size={16} />}</span>
              <div className="chat-bubble">
                <p>{message.content}</p>
                {message.recommendations?.length > 0 && (
                  <div className="chat-recommendations">
                    <span className="section-eyebrow">قطع من المخزون (نتائج فعلية من قاعدة البيانات)</span>
                    <div className="recommendation-grid">
                      {message.recommendations.map((item) => (
                        <article key={item.componentId} className="recommendation-card">
                          <ComponentThumb src={item.imageUrl} alt="" />
                          <span>
                            <strong>{item.name}</strong>
                            {item.nameEn && <small dir="ltr">{item.nameEn}</small>}
                            <small>المتاح الآن: <b dir="ltr">{item.availableQuantity}</b></small>
                          </span>
                        </article>
                      ))}
                    </div>
                    <button type="button" className="button-outline add-recommended" disabled={Boolean(pendingRequest)} onClick={() => onAddMany(message.recommendations)}>
                      <Plus size={14} /> {pendingRequest ? "لديك طلب قيد المراجعة" : "نقل القطع إلى نموذج الطلب (دون إرسال)"} <ArrowLeft size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-row chat-assistant">
              <span className="chat-icon"><Bot size={16} /></span>
              <div className="chat-bubble typing"><i /><i /><i /></div>
            </div>
          )}
        </div>

        {error && <div className="form-alert error-alert assistant-error"><CircleAlert size={16} />{error}</div>}
        <form className="assistant-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <textarea
            rows={2}
            value={input}
            maxLength={2000}
            placeholder="اكتب سؤالك أو صف فكرة مشروعك..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className="button-primary" disabled={busy || !input.trim()} aria-label="إرسال"><Send size={17} /></button>
        </form>
        <div className="assistant-foot"><ShieldCheck size={14} /> التوصيات استرشادية؛ المساعد لا يحجز قطعاً ولا ينشئ طلبات. لا تُحفظ المحادثة على الخادم.</div>
      </section>
    </div>
  );
}
