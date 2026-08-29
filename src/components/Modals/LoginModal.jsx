import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, User, Mail, CheckCircle2, KeyRound, ShieldAlert, Smartphone, Clock, RefreshCw, QrCode, Copy, Eye, EyeOff } from 'lucide-react';
import { dbService } from '../../lib/supabaseClient';
import { verifyTOTP, generateRandomBase32Secret } from '../../lib/totp';
import { requestSecurePasswordReset } from '../../lib/emailService';

export default function LoginModal({ onClose, onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'google2fa' | 'forgotPassword' | 'enterResetCode'
  
  const [rotaryId, setRotaryId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  
  const [otpCode, setOtpCode] = useState('');
  
  // Forgot Password / Reset State
  const [forgotInput, setForgotInput] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [resetAttempts, setResetAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let timer = null;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownSeconds]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!rotaryId || !password) return;

    setIsVerifying(true);
    const authResult = await dbService.authenticateUser(rotaryId, password);
    setIsVerifying(false);

    if (!authResult.success) {
      setErrorMessage(authResult.error || 'Authentication failed.');
      return;
    }

    const user = authResult.user;
    setAuthenticatedUser(user);

    let secret = user.totpSecret;
    if (!secret) {
      // Auto-provision a cryptographically random Base32 secret for this user and save it to Supabase
      secret = generateRandomBase32Secret();
      if (user.id) {
        await dbService.saveUserTotpSecret(user.id, secret);
      }
      setShowKeyDetails(true); // Automatically expand setup key box for first-time 2FA setup
    }
    setTotpSecret(secret);

    setMode('google2fa');
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit Google Authenticator code.');
      return;
    }

    setIsVerifying(true);
    const isValid = await verifyTOTP(totpSecret, otpCode);
    setIsVerifying(false);

    if (!isValid) {
      setErrorMessage('Invalid 6-digit Google Authenticator code. Please check your Google Authenticator app and ensure phone clock is synced.');
      return;
    }

    const rawRole = (authenticatedUser.role || '').toLowerCase().trim();

    if (rawRole === 'dac_member') {
      setErrorMessage('Access Denied: DAC Members do not have access to District or Club Portals.');
      return;
    }

    if (rawRole !== 'officer' && rawRole !== 'president' && rawRole !== 'secretary') {
      setErrorMessage('Access Denied: Account role unauthorized for portal access.');
      return;
    }

    const assignedRole = rawRole;
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    
    // Generate cryptographically secure session token
    const tokenBytes = new Uint8Array(24);
    window.crypto.getRandomValues(tokenBytes);
    const secureToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');

    onLoginSuccess({
      rotaryId: authenticatedUser.rotaryId,
      email: authenticatedUser.email,
      role: assignedRole,
      fullName: authenticatedUser.fullName || null,
      clubName: authenticatedUser.clubName || null,
      post: authenticatedUser.post || authenticatedUser.designation || null,
      mfaVerified: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + FIVE_HOURS_MS,
      sessionToken: `sec_${secureToken}`
    });
    onClose();
  };

  // Step 1: Request Password Reset Code (Zero Exposure)
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setResetSuccessMsg('');

    const cleanInput = (forgotInput || '').trim();
    if (!cleanInput) {
      setErrorMessage('Please enter your registered Rotary ID or Email address.');
      return;
    }

    if (resetAttempts >= 3) {
      setErrorMessage('Security Cap Reached: Maximum 3 password reset requests per 24 hours. Please try again tomorrow.');
      return;
    }

    if (cooldownSeconds > 0) {
      setErrorMessage(`Please wait ${cooldownSeconds} seconds before requesting another reset email.`);
      return;
    }

    setIsVerifying(true);
    const res = await requestSecurePasswordReset(cleanInput);
    setIsVerifying(false);

    if (!res.success) {
      setErrorMessage(res.error || 'No registered officer found with that Rotary ID or Email. Please check your spelling or contact the District Secretariat.');
      return;
    }

    const newAttempts = resetAttempts + 1;
    setResetAttempts(newAttempts);
    setCooldownSeconds(60);

    const masked = res.maskedEmail || 'your registered email';
    setResetTargetEmail(masked);
    setResetSuccessMsg(`A 6-digit password reset passcode has been sent to ${masked}.`);
    setMode('enterResetCode');
  };

  // Step 2: Verify Code and Set New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!resetCodeInput || resetCodeInput.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit reset code received in your email.');
      return;
    }

    if (!newPasswordInput || newPasswordInput.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMessage('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setIsVerifying(true);
    const res = await dbService.resetPassword(forgotInput, resetCodeInput, newPasswordInput);
    setIsVerifying(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update password. Please verify the 6-digit code or request a new one.');
      return;
    }

    // Success!
    setResetSuccessMsg('Password updated successfully! You can now log in with your new password.');
    setRotaryId(forgotInput);
    setPassword('');
    setResetCodeInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setMode('login');
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.68)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="rotaract-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'min(92vh, 660px)',
          overflowY: 'auto',
          padding: '28px 32px',
          position: 'relative',
          border: '2px solid var(--rotaract-pink)',
          animation: 'fadeInUp 0.3s ease-out forwards',
          boxShadow: '0 20px 60px rgba(216, 27, 96, 0.25)',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxSizing: 'border-box'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#FDF0F5',
            border: 'none',
            color: 'var(--rotaract-pink)',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {isVerifying && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="biometric-scan-ring" style={{ marginBottom: '16px', margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--rotaract-pink)', marginBottom: '4px' }}>
              Processing Request...
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Communicating with District 3011 Security Vault...
            </p>
          </div>
        )}

        {!isVerifying && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div 
                style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, var(--rotaract-pink) 0%, var(--rotaract-cranberry-dark) 100%)', 
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  boxShadow: '0 8px 25px rgba(216, 27, 96, 0.3)'
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <div style={{ display: 'inline-flex', marginBottom: '6px' }}>
                <span className="pill-pink" style={{ fontSize: '0.74rem', padding: '3px 12px' }}>
                  <Lock size={12} /> DISTRICT 3011 SECURE PORTAL
                </span>
              </div>
              <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {mode === 'login' && 'Officer Login'}
                {mode === 'google2fa' && 'Google Authenticator 2FA'}
                {mode === 'forgotPassword' && 'Reset Password'}
                {mode === 'enterResetCode' && 'Set New Password'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                {mode === 'login' && 'Enter your official Rotary ID and portal password to log in.'}
                {mode === 'google2fa' && 'Enter the 6-digit code generated in your Google Authenticator App.'}
                {mode === 'forgotPassword' && 'Enter your Rotary ID or registered Email to receive a 6-digit reset passcode.'}
                {mode === 'enterResetCode' && `Enter the 6-digit passcode sent to ${resetTargetEmail || 'your email'} and choose a new password.`}
              </p>
            </div>

            {errorMessage && (
              <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', padding: '12px 14px', borderRadius: '12px', fontSize: '0.84rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                {errorMessage}
              </div>
            )}

            {resetSuccessMsg && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '12px 14px', borderRadius: '12px', fontSize: '0.84rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                {resetSuccessMsg}
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Official Rotary ID or Email *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Enter Rotary ID or Email"
                      required
                      value={rotaryId}
                      onChange={(e) => setRotaryId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid rgba(216, 27, 96, 0.25)',
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                    <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rotaract-pink)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Portal Password *
                    </label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setMode('forgotPassword');
                        setErrorMessage('');
                        setResetSuccessMsg('');
                      }} 
                      style={{ background: 'none', border: 'none', color: 'var(--rotaract-pink)', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter portal password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid rgba(216, 27, 96, 0.25)',
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rotaract-pink)' }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-rotaract" style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: '4px' }}>
                  Proceed to Google 2FA <KeyRound size={18} />
                </button>
              </form>
            )}

            {/* TAB 2: GOOGLE 2FA */}
            {mode === 'google2fa' && (
              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#FDF5F8', padding: '16px 14px', borderRadius: '14px', border: '1px solid rgba(216,27,96,0.15)', textAlign: 'center' }}>
                  <Smartphone size={24} style={{ color: 'var(--rotaract-pink)', marginBottom: '4px' }} />
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Google Authenticator 2FA Verification
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--rotaract-pink)', marginTop: '4px' }}>
                    {authenticatedUser?.fullName || authenticatedUser?.name || rotaryId}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                    {authenticatedUser?.post || null}
                  </div>
                </div>

                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Authenticator Secret Key</span>
                    <button
                      type="button"
                      onClick={() => setShowKeyDetails(!showKeyDetails)}
                      style={{ background: 'none', border: 'none', color: 'var(--rotaract-pink)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {showKeyDetails ? 'Hide Secret' : 'Show Secret / Setup'}
                    </button>
                  </div>

                  {showKeyDetails && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E5E7EB' }}>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '0.76rem' }}>
                        Add this key into your Google Authenticator app (or scan barcode):
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}>
                        <code style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--rotaract-pink)', flex: 1, fontFamily: 'monospace' }}>
                          {totpSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(totpSecret);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Copy size={14} /> {copiedKey ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)', textAlign: 'center' }}>
                    Enter 6-Digit Google 2FA Code *
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="123456"
                    autoFocus
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '2px solid var(--rotaract-pink)',
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      letterSpacing: '8px',
                      textAlign: 'center',
                      color: 'var(--rotaract-pink)',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', marginTop: '6px' }}>
                    Open your Google Authenticator app to view the 6-digit code.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setMode('login')} 
                    className="btn-rotaract-outline" 
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-rotaract" 
                    style={{ flex: 2, justifyContent: 'center', padding: '12px' }}
                  >
                    <CheckCircle2 size={18} /> Verify & Log In
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: STEP 1 - FORGOT PASSWORD REQUEST */}
            {mode === 'forgotPassword' && (
              <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#FFFDF0', border: '1px solid #FDE68A', padding: '12px 14px', borderRadius: '12px', fontSize: '0.78rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ flexShrink: 0 }} />
                  Rate-Limited Protection: Max 3 reset requests per 24 hours.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Registered Rotary ID or Email *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="e.g. 10482950 or president@rotaract3011.org"
                      required
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid rgba(216, 27, 96, 0.25)',
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                    <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rotaract-pink)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setMode('login');
                      setErrorMessage('');
                    }} 
                    className="btn-rotaract-outline" 
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                  >
                    Back to Login
                  </button>
                  <button 
                    type="submit" 
                    disabled={cooldownSeconds > 0 || resetAttempts >= 3}
                    className="btn-rotaract" 
                    style={{ 
                      flex: 2, 
                      justify: 'center', 
                      padding: '12px',
                      opacity: (cooldownSeconds > 0 || resetAttempts >= 3) ? 0.6 : 1,
                      cursor: (cooldownSeconds > 0 || resetAttempts >= 3) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {cooldownSeconds > 0 ? (
                      <>Wait {cooldownSeconds}s <RefreshCw size={16} className="spin" /></>
                    ) : (
                      'Send Reset Passcode'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: STEP 2 - ENTER 6-DIGIT PASSCODE & SET NEW PASSWORD */}
            {mode === 'enterResetCode' && (
              <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 14px', borderRadius: '12px', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} style={{ flexShrink: 0 }} />
                  Check your inbox for the 6-digit passcode sent to <strong>{resetTargetEmail}</strong>.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)', textAlign: 'center' }}>
                    Enter 6-Digit Email Passcode *
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="123456"
                    autoFocus
                    required
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '2px solid var(--rotaract-pink)',
                      fontSize: '1.5rem',
                      fontWeight: 900,
                      letterSpacing: '8px',
                      textAlign: 'center',
                      color: 'var(--rotaract-pink)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    New Portal Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password (min. 6 characters)"
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid rgba(216, 27, 96, 0.25)',
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rotaract-pink)' }} />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Confirm New Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid rgba(216, 27, 96, 0.25)',
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                    <CheckCircle2 size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rotaract-pink)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setMode('forgotPassword');
                      setErrorMessage('');
                    }} 
                    className="btn-rotaract-outline" 
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-rotaract" 
                    style={{ flex: 2, justifyContent: 'center', padding: '12px' }}
                  >
                    Update Password <KeyRound size={16} />
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}

