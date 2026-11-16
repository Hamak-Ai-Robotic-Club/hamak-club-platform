import { useState } from "react";
import { KeyRound, LogOut, Plus, Search, Shield, Snowflake, Sun, UserPlus, Users } from "lucide-react";
import { Api } from "../../api/client.js";
import { ConfirmDialog, ErrorBlock, LoadingBlock, Modal, useLoader } from "../../components/ui.jsx";
import { formatDate, nf } from "../../lib/format.js";

function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function CreateUserDialog({ onClose, onCreated, toast }) {
  const [form, setForm] = useState({ accountType: "TEAM", teamName: "", username: "", password: randomPassword() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function save() {
    setBusy(true);
    setError("");
    try {
      const { item } = await Api.createUser({
        accountType: form.accountType,
        username: form.username.trim().toLowerCase(),
        password: form.password,
        teamName: form.accountType === "TEAM" ? form.teamName.trim() : undefined,
      });
      setCreated({ ...item, password: form.password });
      toast("تم إنشاء الحساب");
      onCreated();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal title="تم إنشاء الحساب" eyebrow="سلّم البيانات للفريق" onClose={onClose} footer={<button className="button-primary" onClick={onClose}>تم</button>}>
        <div className="credential-card" dir="ltr">
          <span>Username: <b>{created.username}</b></span>
          <span>Password: <b>{created.password}</b></span>
        </div>
        <p className="modal-message">انسخ كلمة المرور الآن؛ لا يمكن عرضها لاحقاً (تُخزَّن مجزأة فقط). يمكنك إعادة تعيينها عند الحاجة.</p>
        <button className="button-outline" onClick={() => navigator.clipboard?.writeText(`${created.username} / ${created.password}`)}>نسخ البيانات</button>
      </Modal>
    );
  }

  return (
    <Modal
      title="إنشاء حساب"
      eyebrow="الحسابات"
      onClose={onClose}
      footer={<><button className="button-outline" onClick={onClose} disabled={busy}>إلغاء</button><button className="button-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الإنشاء..." : "إنشاء"}</button></>}
    >
      <div className="segmented" role="group" aria-label="نوع الحساب">
        <button className={form.accountType === "TEAM" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, accountType: "TEAM" }))}><Users size={14} /> حساب فريق</button>
        <button className={form.accountType === "ADMIN" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, accountType: "ADMIN" }))}><Shield size={14} /> حساب أدمن</button>
      </div>
      {form.accountType === "TEAM" && (
        <>
          <label className="field-label" htmlFor="u-team">اسم الفريق *</label>
          <input id="u-team" className="form-input" value={form.teamName} onChange={set("teamName")} maxLength={80} placeholder="مثال: فريق النخبة" />
        </>
      )}
      <label className="field-label" htmlFor="u-name">اسم المستخدم *</label>
      <input id="u-name" className="form-input" dir="ltr" value={form.username} onChange={set("username")} placeholder="team-alpha" autoCapitalize="none" />
      <label className="field-label" htmlFor="u-pass">كلمة المرور (8 أحرف على الأقل)</label>
      <div className="inline-input">
        <input id="u-pass" className="form-input" dir="ltr" value={form.password} onChange={set("password")} />
        <button type="button" className="button-outline" onClick={() => setForm((c) => ({ ...c, password: randomPassword() }))}>توليد</button>
      </div>
      {form.accountType === "ADMIN" && <div className="form-alert warning-alert">حساب الأدمن يملك صلاحيات كاملة، بما فيها إنشاء حسابات أدمن أخرى وتصفير البيانات.</div>}
      {error && <div className="form-alert error-alert">{error}</div>}
    </Modal>
  );
}

function ResetPasswordDialog({ user, onClose, toast }) {
  const [password, setPassword] = useState(randomPassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await Api.resetPassword(user.id, password);
      setDone(true);
      toast("تمت إعادة تعيين كلمة المرور وإنهاء الجلسات");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`إعادة تعيين كلمة مرور ${user.username}`}
      onClose={onClose}
      footer={done ? <button className="button-primary" onClick={onClose}>تم</button> : <><button className="button-outline" onClick={onClose}>إلغاء</button><button className="button-primary" onClick={save} disabled={busy}>حفظ</button></>}
    >
      {done ? (
        <div className="credential-card" dir="ltr"><span>Username: <b>{user.username}</b></span><span>Password: <b>{password}</b></span></div>
      ) : (
        <>
          <div className="inline-input">
            <input className="form-input" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="button-outline" onClick={() => setPassword(randomPassword())}>توليد</button>
          </div>
          <p className="modal-message">ستُنهى جميع جلسات هذا الحساب فوراً.</p>
        </>
      )}
      {error && <div className="form-alert error-alert">{error}</div>}
    </Modal>
  );
}

export default function AdminUsers({ toast, account }) {
  const [archived, setArchived] = useState(false);
  const { data, loading, error, reload } = useLoader(() => Api.users(archived), [archived]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const users = (data?.items || []).filter((user) => `${user.username} ${user.teamName || ""} ${user.displayName || ""}`.toLowerCase().includes(query.toLowerCase()));
  const teams = users.filter((user) => user.role === "user");
  const admins = users.filter((user) => user.role === "admin");

  async function runConfirm() {
    setBusy(true);
    try {
      if (confirm.type === "freeze") {
        await Api.setUserStatus(confirm.user.id, !confirm.user.isActive);
        toast(confirm.user.isActive ? "تم تجميد الحساب وإبطال جلساته" : "تمت إعادة تفعيل الحساب");
      } else {
        await Api.revokeSessions(confirm.user.id);
        toast("تم إنهاء جلسات الحساب");
      }
      setConfirm(null);
      reload();
    } catch (actionError) {
      toast(actionError.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function UserTable({ list, title, icon: Icon }) {
    return (
      <section className="panel section-block">
        <div className="requests-panel-heading"><div><span className="section-eyebrow"><Icon size={12} /> {title}</span><h3>{nf(list.length)} حساب</h3></div></div>
        {list.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>اسم المستخدم</th>{title === "حسابات الفرق" && <th>الفريق</th>}<th>الحالة</th><th>جلسات نشطة</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
              <tbody>
                {list.map((user) => (
                  <tr key={user.id} className={!user.isActive ? "row-muted" : ""}>
                    <td dir="ltr"><strong>@{user.username}</strong>{user.id === account.id && <small className="you-tag"> (أنت)</small>}</td>
                    {title === "حسابات الفرق" && <td>{user.teamName}</td>}
                    <td>{user.archived ? <span className="status-badge status-cancelled">مؤرشف</span> : user.isActive ? <span className="status-badge status-approved">نشط</span> : <span className="status-badge status-rejected">مجمّد</span>}</td>
                    <td dir="ltr">{nf(user.activeSessions)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      {!user.archived && (
                        <div className="row-actions">
                          <button className="row-action" title={user.isActive ? "تجميد" : "إعادة تفعيل"} disabled={user.id === account.id} onClick={() => setConfirm({ type: "freeze", user })}>{user.isActive ? <Snowflake size={15} /> : <Sun size={15} />}</button>
                          <button className="row-action" title="إنهاء الجلسات" disabled={!user.activeSessions} onClick={() => setConfirm({ type: "sessions", user })}><LogOut size={15} /></button>
                          <button className="row-action" title="إعادة تعيين كلمة المرور" onClick={() => setResetting(user)}><KeyRound size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="dash-empty">لا توجد حسابات.</p>}
      </section>
    );
  }

  if (loading && !data) return <div className="page-content"><LoadingBlock /></div>;
  if (error && !data) return <div className="page-content"><ErrorBlock message={error} onRetry={reload} /></div>;

  return (
    <div className="page-content">
      <section className="admin-welcome">
        <div>
          <span className="section-eyebrow">الحسابات والجلسات</span>
          <h2>حساب مشترك <span>لكل فريق</span></h2>
          <p>لحساب الفريق جلسة نشطة واحدة فقط. التجميد وإعادة تعيين كلمة المرور يُبطلان الجلسات فوراً.</p>
        </div>
        <button className="button-primary" onClick={() => setCreating(true)}><UserPlus size={16} /> حساب جديد</button>
      </section>
      <div className="catalog-toolbar">
        <label className="catalog-search wide-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم المستخدم أو الفريق..." aria-label="بحث" /></label>
        <label className="toggle-inline"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} /> إظهار المؤرشفة</label>
      </div>
      <UserTable list={teams} title="حسابات الفرق" icon={Users} />
      <UserTable list={admins} title="حسابات الإدارة" icon={Shield} />

      {creating && <CreateUserDialog toast={toast} onClose={() => setCreating(false)} onCreated={reload} />}
      {resetting && <ResetPasswordDialog user={resetting} toast={toast} onClose={() => { setResetting(null); reload(); }} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === "freeze" ? (confirm.user.isActive ? `تجميد @${confirm.user.username}؟` : `إعادة تفعيل @${confirm.user.username}؟`) : `إنهاء جلسات @${confirm.user.username}؟`}
          message={confirm.type === "freeze" ? (confirm.user.isActive ? "سيُمنع الحساب من الدخول وتُبطل جلساته الحالية فوراً." : "سيتمكن الحساب من تسجيل الدخول مجدداً.") : "سيُطلب من الحساب تسجيل الدخول من جديد. مفيد عندما يبقى حساب الفريق مفتوحاً على جهاز آخر."}
          confirmLabel="تأكيد"
          danger={confirm.type === "freeze" && confirm.user.isActive}
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
      <button className="fab" onClick={() => setCreating(true)} aria-label="حساب جديد"><Plus size={20} /></button>
    </div>
  );
}
