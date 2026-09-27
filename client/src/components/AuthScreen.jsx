import React, { useState } from 'react';
import './AuthScreen.css';
import { User, Lock, Eye, EyeOff, Mail, ArrowRight, Sparkles, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import MeteorCanvas from './MeteorCanvas';
import { supabase } from '../supabase';

export default function AuthScreen({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Form State
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Format email: if user enters just a username, ensure valid email format
  const getFormattedEmail = (input) => {
    const trimmed = input.trim();
    if (trimmed.includes('@')) return trimmed;
    // Format campus email if just username provided
    return `${trimmed.toLowerCase().replace(/\s+/g, '.')}@campus.edu`;
  };

  // Handle Email + Password Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const email = getFormattedEmail(emailOrUser);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg(`Password reset instructions sent to ${email}`);
        setLoading(false);
        return;
      }

      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim() || emailOrUser.trim(),
              username: emailOrUser.trim(),
              role: 'Student Reporter'
            }
          }
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Account registered successfully! Entering campus...');
          setTimeout(() => onAuthSuccess(data.user), 600);
        } else if (data.user) {
          setSuccessMsg('Registration successful! Check your email for confirmation, or explore as guest.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        setSuccessMsg('Authentication successful! Loading campus map...');
        setTimeout(() => onAuthSuccess(data.user), 500);
      }
    } catch (err) {
      console.error('Supabase Auth error:', err);
      let msg = err.message || 'Authentication failed. Please verify credentials.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        msg = 'Invalid email or password. If you are new here, click Register below!';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setGoogleLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });

      if (error) throw error;
    } catch (err) {
      console.warn('Google OAuth error:', err);
      setErrorMsg(
        'Google sign-in is not configured yet on this Supabase project. Please use email/password or Instant Guest Demo below!'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // Instant Guest / Demo Mode
  const handleGuestDemo = () => {
    const demoStudent = {
      id: 'demo-student-id',
      email: 'alex.rivera@campus.edu',
      user_metadata: {
        full_name: 'Alex Rivera',
        role: 'Campus Facilities Lead',
        avatar_url: null,
      }
    };
    onAuthSuccess(demoStudent);
  };

  return (
    <div className="auth-viewport">
      {/* Background vignette & ambient glow */}
      <div className="auth-bg-overlay" />
      <div className="auth-ambient-glow" />

      {/* Meteors and animated stardust */}
      <MeteorCanvas />

      {/* Frosted Glass Login Card */}
      <div className="auth-card">
        {/* Title */}
        <h1 className="auth-title">
          {isForgotPassword ? 'Reset Password' : isRegister ? 'Register' : 'Login'}
        </h1>

        {/* Feedback Alert Banners */}
        {errorMsg && (
          <div className="auth-alert-box auth-alert-error">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="auth-alert-box auth-alert-success">
            {successMsg}
          </div>
        )}

        {/* Continue with Google button */}
        {!isForgotPassword && (
          <>
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            <div className="auth-divider">or with email</div>
          </>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Full Name (Registration only) */}
          {isRegister && (
            <div className="auth-input-group">
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="auth-input"
              />
              <span className="auth-input-icon">
                <User size={18} />
              </span>
            </div>
          )}

          {/* Username / Email */}
          <div className="auth-input-group">
            <input
              type={isRegister ? "email" : "text"}
              placeholder={isRegister ? "Campus Email (e.g. student@campus.edu)" : "Username"}
              value={emailOrUser}
              onChange={(e) => setEmailOrUser(e.target.value)}
              required
              className="auth-input"
              autoComplete="username"
            />
            <span className="auth-input-icon">
              {emailOrUser.includes('@') ? <Mail size={18} /> : <User size={18} />}
            </span>
          </div>

          {/* Password (if not forgot password mode) */}
          {!isForgotPassword && (
            <div className="auth-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="auth-input"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Lock size={18} />}
              </button>
            </div>
          )}

          {/* Options Row: Remember Me & Forgot Password */}
          {!isRegister && !isForgotPassword && (
            <div className="auth-options-row">
              <label className="auth-remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="auth-checkbox"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => {
                  setIsForgotPassword(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || googleLoading}
          >
            {loading ? (
              <span>Processing...</span>
            ) : isForgotPassword ? (
              <span>Send Reset Link</span>
            ) : isRegister ? (
              <span>Register</span>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* Mode Switchers */}
        {isForgotPassword ? (
          <p className="auth-switch-text">
            Remembered your credentials?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              Back to Login
            </button>
          </p>
        ) : isRegister ? (
          <p className="auth-switch-text">
            Already have an account?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              Login
            </button>
          </p>
        ) : (
          <p className="auth-switch-text">
            Don't have an account?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => {
                setIsRegister(true);
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              Register
            </button>
          </p>
        )}

        {/* Quick Instant Guest / Demo Mode */}
        <div className="auth-guest-option">
          <button
            type="button"
            className="auth-guest-btn"
            onClick={handleGuestDemo}
          >
            ⚡ Instant Guest Access (Demo Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
