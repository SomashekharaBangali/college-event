import { useEffect, useState } from 'react';
import CampusDashboard from './CampusDashboard.jsx';
import {
  ArrowRight,
  AtSign,
  FileSpreadsheet,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { getCurrentUser, login, signOut as clearSession, signup } from '../api/auth.js';
import { apiRequest, getSessionToken } from '../api/http.js';

const initialForm = { name: '', email: '', password: '' };

export default function SignupPage() {
  const [form, setForm] = useState(initialForm);
  const [stage, setStage] = useState('signup');
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    apiRequest('/config')
      .then((config) => { if (isCurrent) setAllowedDomains(config.allowedEmailDomains); })
      .catch((requestError) => { if (isCurrent) setError(requestError.message); });
    if (getSessionToken()) {
      getCurrentUser()
        .then(({ user }) => {
          if (!isCurrent) return;
          setForm((current) => ({ ...current, name: user.name, email: user.email }));
          setStage('signed-in');
        })
        .catch((requestError) => { if (isCurrent) setError(requestError.message); });
    }
    return () => { isCurrent = false; };
  }, []);

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function switchStage(nextStage) {
    setStage(nextStage);
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, password: '' }));
  }

  function signOut() {
    clearSession();
    setStage('login');
    setForm((current) => ({ ...current, password: '' }));
    setMessage('');
    setError('');
  }

  async function handleSignup(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const result = await signup(form);
      setForm((current) => ({ ...current, name: result.user.name, email: result.user.email, password: '' }));
      setMessage('Your account is saved in the shared college workbook.');
      setStage('signed-in');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const result = await login({ email: form.email, password: form.password });
      setForm((current) => ({ ...current, name: result.user.name, email: result.user.email, password: '' }));
      setMessage('You are signed in on this device.');
      setStage('signed-in');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (stage === 'signed-in') {
    return <CampusDashboard user={{ name: form.name, email: form.email }} onSignOut={signOut} />;
  }

  return (
    <main className="auth-layout min-h-screen">
      <aside className="campus-panel" aria-label="Campus Connect">
        <div className="panel-topline">
          <span className="brand-mark">cc</span>
          <span className="brand-name">campus connect</span>
        </div>
        <div className="campus-caption">
          <span className="eyebrow">YOUR CAMPUS, CLOSER</span>
          <p>Find your people.<br />Make campus yours.</p>
          <span className="caption-rule" />
          <span className="caption-note">A little more connected, every day.</span>
        </div>
        <span className="photo-credit">Campus life, together</span>
      </aside>

      <section className="form-panel">
        <div className="mobile-brand">
          <span className="brand-mark">cc</span>
          <span className="brand-name">campus connect</span>
        </div>
        <div className="workbook-control">
          <div className="workbook-status">
            <FileSpreadsheet size={17} aria-hidden="true" />
            <span>Shared Book2.xlsx on the college server</span>
          </div>
        </div>
        <div className="domain-control">
          <label>College email domains</label>
          <p>{allowedDomains.length ? allowedDomains.join(', ') : 'Loading college settings…'}</p>
          <p>Signup is restricted to these college domains. Updates are shared live with signed-in campus users.</p>
        </div>
        <div className="form-wrap">
          {stage === 'signup' && (
            <>
              <p className="eyebrow form-eyebrow">A PLACE TO BELONG</p>
              <h1>Create your account</h1>
              <p className="form-intro">Join your campus community with your college email.</p>

              <form className="auth-form" onSubmit={handleSignup}>
                <label htmlFor="name">Your name</label>
                <div className="input-wrap">
                  <UserRound aria-hidden="true" />
                  <input id="name" name="name" autoComplete="name" maxLength={80} required value={form.name} onChange={updateForm} placeholder="Jordan Lee" />
                </div>

                <label htmlFor="email">College email</label>
                <div className="input-wrap">
                  <AtSign aria-hidden="true" />
                  <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={updateForm} placeholder="you@college.edu" />
                </div>

                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={form.password} onChange={updateForm} placeholder="At least 10 characters" />
                </div>
                <p className="field-hint">Use 10 or more characters.</p>

                {error && <p className="status-message error-message" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving account...' : 'Create account'}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
              <p className="privacy-note"><FileSpreadsheet size={15} aria-hidden="true" /> Saved to shared Book2.xlsx. Email OTP is unavailable without a mail service.</p>
              <p className="switch-auth">Already have an account? <button className="inline-button" type="button" onClick={() => switchStage('login')}>Log in</button></p>
            </>
          )}

          {stage === 'login' && (
            <>
              <p className="eyebrow form-eyebrow">WELCOME BACK</p>
              <h1>Log in</h1>
              <p className="form-intro">Sign in with your account in the shared college workbook.</p>

              <form className="auth-form" onSubmit={handleLogin}>
                <label htmlFor="login-email">College email</label>
                <div className="input-wrap">
                  <AtSign aria-hidden="true" />
                  <input id="login-email" name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={updateForm} placeholder="you@college.edu" />
                </div>

                <label htmlFor="login-password">Password</label>
                <div className="input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input id="login-password" name="password" type="password" autoComplete="current-password" maxLength={72} required value={form.password} onChange={updateForm} placeholder="Your password" />
                </div>

                {error && <p className="status-message error-message" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Log in'}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
              <p className="switch-auth">New to Campus Connect? <button className="inline-button" type="button" onClick={() => switchStage('signup')}>Create an account</button></p>
            </>
          )}

        </div>
        <footer className="form-footer"><span>Campus Connect</span><span>Built for campus life</span></footer>
      </section>
    </main>
  );
}