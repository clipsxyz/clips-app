import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiX, FiEye, FiEyeOff, FiFileText, FiShield, FiCheck } from 'react-icons/fi';
import { loginUser, registerUser } from '../api/client';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion, signupFeedTierRows } from '../utils/placeFeedLevels';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
import Flag from '../components/Flag';
import { consumePublicShareReturnPath } from '../utils/publicShare';
import { db } from '../utils/db';

const LOCAL_REGISTRATIONS_KEY = 'gazetteer_local_registrations';
const avatarStorageKey = (id: string) => `clips_app_avatar_${id}`;
const interestOptions = [
  'Food & Dining', 'Sports', 'Music', 'Art & Culture', 'Technology',
  'Travel', 'Fashion', 'Photography', 'Fitness', 'Gaming',
  'Books', 'Movies', 'Nature', 'Cooking', 'Dancing',
];

type PageMode = 'signup' | 'login';

function getLocalRegistrations(): Record<string, { password: string; userData: any }> {
  try {
    const s = localStorage.getItem(LOCAL_REGISTRATIONS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

/** Strip huge base64 blobs — they belong in IndexedDB, not localStorage. */
function userDataForLocalStorage(userData: Record<string, unknown>) {
  const copy = { ...userData };
  if (typeof copy.avatarUrl === 'string' && copy.avatarUrl.length > 500) {
    delete copy.avatarUrl;
  }
  if (typeof copy.profileBackgroundUrl === 'string' && copy.profileBackgroundUrl.length > 500) {
    delete copy.profileBackgroundUrl;
  }
  delete copy.password;
  return copy;
}

function saveLocalRegistration(email: string, password: string, userData: Record<string, unknown>) {
  const key = email.toLowerCase().trim();
  const slim = userDataForLocalStorage(userData);
  const reg = getLocalRegistrations();
  for (const k of Object.keys(reg)) {
    if (reg[k]?.userData) {
      reg[k].userData = userDataForLocalStorage(reg[k].userData);
    }
  }
  reg[key] = { password, userData: slim };
  try {
    localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(reg));
  } catch {
    try {
      localStorage.removeItem(LOCAL_REGISTRATIONS_KEY);
      localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify({ [key]: { password, userData: slim } }));
    } catch {
      // Backup login list is optional; signup should still succeed.
    }
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  // Lock body scroll on mobile so the page stays fixed
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = '';
    };
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = React.useState<PageMode>('signup');
  const [loginError, setLoginError] = React.useState('');
  const [signupError, setSignupError] = React.useState('');
  const [signupFieldErrors, setSignupFieldErrors] = React.useState<Record<string, string>>({});
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [signupSubmitting, setSignupSubmitting] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  React.useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'login' || modeParam === 'signup') {
      setMode(modeParam);
    }
  }, [searchParams]);

  const getPostAuthRedirect = React.useCallback(() => {
    const returnPath = consumePublicShareReturnPath();
    if (returnPath && returnPath.startsWith('/p/')) {
      return returnPath;
    }
    return '/feed';
  }, []);
  
  // Get step from URL parameter, default to 1 - use URL as source of truth
  const stepFromUrl = parseInt(searchParams.get('step') || '1', 10);
  const step = (stepFromUrl >= 1 && stepFromUrl <= 4) ? stepFromUrl : 1;

  const signupStepLabel =
    step === 1
      ? 'Step 1: Account security'
      : step === 2
        ? 'Step 2: Profile and location'
        : step === 3
          ? 'Step 3: Profile photo'
          : 'Step 4: Your interests';
  
  // Helper function to update step (updates both state and URL)
  const updateStep = React.useCallback((newStep: number) => {
    if (newStep >= 1 && newStep <= 4) {
      setSignupError('');
      setSearchParams({ mode: 'signup', step: newStep.toString() });
    }
  }, [setSearchParams]);

  // Step 2: Profile & location
  const [name, setName] = React.useState('');
  const [local, setLocal] = React.useState('');
  const [regional, setRegional] = React.useState('');
  const [national, setNational] = React.useState('');
  const [homeLocationQuery, setHomeLocationQuery] = React.useState('');
  const [preferredLocationQuery, setPreferredLocationQuery] = React.useState('');
  const [preferredLocations, setPreferredLocations] = React.useState<string[]>([]);

  // Step 1: Account details (email, password, birthday)
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [birthMonth, setBirthMonth] = React.useState('');
  const [birthDay, setBirthDay] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [accountType, setAccountType] = React.useState<'personal' | 'business' | null>(null);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [acceptedGuidelines, setAcceptedGuidelines] = React.useState(false);
  const [profilePicture, setProfilePicture] = React.useState<string | null>(null);

  // Password visibility toggle
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotSent, setForgotSent] = React.useState(false);

  // Password strength: 0=weak, 1=fair, 2=good, 3=strong
  function getPasswordStrength(pw: string): number {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score >= 4) return 3;
    if (score >= 2) return 2;
    if (score >= 1) return 1;
    return 0;
  }

  const signupPlaceInputClass =
    'w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 py-2 sm:py-2.5 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white';

  const MIN_AGE = 13;

  function getAgeFromBirthday(): number | null {
    const m = parseInt(birthMonth, 10);
    const d = parseInt(birthDay, 10);
    const y = parseInt(birthYear, 10);
    if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) return null;
    const today = new Date();
    const birth = new Date(y, m - 1, d);
    if (birth > today) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const mDiff = today.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  const handleFirstName = name.trim().split(/\s+/)[0] || 'yourname';
  const handlePreview = regional ? `${handleFirstName}@${regional}` : `${handleFirstName}@yourregion`;
  const previewCountryFlag = normalizeCountryFlagInput('', national);
  const homeLocationComplete = Boolean(local && regional && national);
  const birthdateComplete = React.useMemo(() => {
    const age = getAgeFromBirthday();
    return age !== null && age >= MIN_AGE;
  }, [birthMonth, birthDay, birthYear]);
  const step2CanContinue = Boolean(name.trim() && homeLocationComplete && birthdateComplete);
  const step1CanContinue =
    Boolean(accountType && email.trim() && password.length >= 8 && password === confirmPassword && acceptedTerms && acceptedGuidelines);

  function applyHomeLocation(suggestion: LocationSuggestion) {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    setLocal(parsed.local);
    setRegional(parsed.regional);
    setNational(parsed.national);
    setHomeLocationQuery(parsed.fullName || suggestion.name);
  }

  function clearHomeLocation() {
    setLocal('');
    setRegional('');
    setNational('');
    setHomeLocationQuery('');
  }

  function addPreferredLocation(suggestion: LocationSuggestion) {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    const label = parsed.displayName || parsed.local || suggestion.name.split(',')[0].trim();
    if (!label) return;
    setPreferredLocations((prev) => {
      if (prev.some((p) => p.toLowerCase() === label.toLowerCase())) return prev;
      if (prev.length >= 12) return prev;
      return [...prev, label];
    });
    setPreferredLocationQuery('');
  }

  function removePreferredLocation(label: string) {
    setPreferredLocations((prev) => prev.filter((p) => p !== label));
  }

  function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email || !password || !confirmPassword) {
      if (!email) nextErrors.email = 'Email is required.';
      if (!password) nextErrors.password = 'Password is required.';
      if (!confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.';
    }
    if (!accountType) {
      nextErrors.accountType = 'Please choose Personal or Business account.';
    }
    if (!acceptedTerms) {
      nextErrors.terms = 'You must accept Terms.';
    }
    if (!acceptedGuidelines) {
      nextErrors.guidelines = 'You must accept Community Guidelines.';
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (password && password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setSignupFieldErrors(nextErrors);
      setSignupError('Please fix the highlighted fields.');
      return;
    }
    setSignupFieldErrors({});
    setSignupError('');
    updateStep(2);
  }

  function handleLocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = 'Full name is required.';
    if (!local || !regional || !national) {
      nextErrors.homeLocation = 'Search and select your home area from the suggestions.';
    }
    if (!birthMonth || !birthDay || !birthYear) {
      nextErrors.birthdate = 'Please enter your date of birth.';
    }
    const age = getAgeFromBirthday();
    if (age === null) {
      nextErrors.birthdate = 'Please enter a valid date of birth.';
    } else if (age < MIN_AGE) {
      nextErrors.birthdate = `You must be at least ${MIN_AGE} years old to create an account.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setSignupFieldErrors(nextErrors);
      setSignupError('Please complete all required profile fields.');
      return;
    }
    setSignupFieldErrors({});
    setSignupError('');
    updateStep(3);
  }

  function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupFieldErrors({});
    setSignupError('');
    updateStep(4);
  }

  async function handleInterestsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupFieldErrors({});
    setSignupError('');
    setSignupSubmitting(true);
    const age = getAgeFromBirthday();
    const consentTimestamp = new Date().toISOString();
    const placesTraveled = preferredLocations.slice(0, 12);

    const userId = email.trim().toLowerCase();
    const userData = {
      id: userId,
      name: name.trim(),
      email: email.trim(),
      password: password,
      age: age ?? undefined,
      interests,
      local: local,
      regional: regional,
      national: national,
      handle: `${name.trim().split(/\s+/)[0] || name.trim()}@${regional}`,
      countryFlag: normalizeCountryFlagInput('', national),
      avatarUrl: profilePicture || undefined,
      placesTraveled: placesTraveled.length > 0 ? placesTraveled : undefined,
      accountType: accountType ?? 'personal',
      termsAcceptedAt: consentTimestamp,
      guidelinesAcceptedAt: consentTimestamp,
    };

    if (profilePicture && profilePicture.length > 2000) {
      try {
        await db.set(avatarStorageKey(userId), profilePicture);
      } catch {
        // Non-fatal; login() also persists large avatars to IndexedDB.
      }
    }

    try {
      const apiResponse = await registerUser({
        username: email.trim(),
        email: email.trim(),
        password,
        displayName: name.trim(),
        handle: `${name.trim().split(/\s+/)[0] || name.trim()}@${regional}`,
        locationLocal: local,
        locationRegional: regional,
        locationNational: national,
        accountType: (accountType ?? 'personal') as 'personal' | 'business',
        isBusiness: accountType === 'business',
      });
      const token = (apiResponse as { token?: string })?.token;
      if (token) localStorage.setItem('authToken', token);
    } catch {
      // Keep local registration fallback behavior aligned with RN.
    }

    try {
      login(userData);
      saveLocalRegistration(email.trim(), password, userData);
      nav(getPostAuthRedirect(), { replace: true, state: { fromSignup: true } });
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setSignupError(message);
    } finally {
      setSignupSubmitting(false);
    }
  }

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 5
          ? [...prev, interest]
          : prev
    );
  }

  function handleProfilePictureSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePicture(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter email and password');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await loginUser(loginEmail.trim(), loginPassword);
      const token = (res as { token?: string }).token;
      const apiUser = (res as { user?: any }).user;
      if (token) localStorage.setItem('authToken', token);
      if (apiUser) {
        const userData = {
          name: apiUser.display_name || apiUser.name || apiUser.username || '',
          email: apiUser.email || '',
          handle: apiUser.handle || '',
          local: apiUser.location_local || '',
          regional: apiUser.location_regional || '',
          national: apiUser.location_national || '',
          avatarUrl: apiUser.avatar_url,
          is_private: apiUser.is_private || false,
          accountType:
            apiUser.account_type === 'business' || apiUser.accountType === 'business' || apiUser.is_business === true
              ? 'business'
              : 'personal',
        };
        login(userData);
        nav(getPostAuthRedirect(), { replace: true });
      }
    } catch (err: any) {
      const isConnectionError =
        err?.message === 'CONNECTION_REFUSED' ||
        err?.name === 'ConnectionRefused' ||
        err?.message?.includes('Failed to fetch');
      const is401 = err?.status === 401;

      // Fallback: if backend is down or invalid credentials, try local (mock) registrations from sign-up
      const key = loginEmail.trim().toLowerCase();
      const localReg = getLocalRegistrations();
      const stored = localReg[key];
      if (stored && stored.password === loginPassword) {
        login(stored.userData);
        nav(getPostAuthRedirect(), { replace: true });
        return;
      }
      // Also try current user in localStorage (e.g. signed up before we stored localRegistrations)
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const u = JSON.parse(savedUser);
          if (u?.email?.toLowerCase() === key && u?.password === loginPassword) {
            login(u);
            nav(getPostAuthRedirect(), { replace: true });
            return;
          }
        }
      } catch (_) {}

      if (isConnectionError) {
        setLoginError('Backend unavailable. Use Sign up to create an account, or log in with one you created here.');
      } else {
        setLoginError('Invalid email or password.');
      }
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div 
      className="h-full min-h-0 flex-1 flex flex-col overflow-hidden items-center px-4 sm:px-6 py-4 sm:py-6 relative"
      style={{ 
        backgroundColor: '#000000',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-md flex-1 flex flex-col min-h-0">
        {mode === 'login' ? (
          <div
            className="max-w-md mx-auto rounded-2xl p-0.5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
          >
            {showForgotPassword ? (
              <div className="rounded-2xl bg-black px-8 py-8 flex flex-col">
                <div className="text-center mb-6">
                  <p className="text-xs text-gray-500 mb-2">Recovery</p>
                  <h1 className="text-2xl font-light mb-2 tracking-tight text-white">Reset password</h1>
                  <p className="text-sm text-gray-400">Recover your Gazetteer account</p>
                </div>
                {forgotSent ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">
                      If an account exists for that email, we&apos;ve sent a reset link. Check your inbox.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                      className="w-full py-2 bg-gradient-to-r from-teal-400 via-sky-500 to-fuchsia-500 text-white rounded-sm hover:brightness-110 text-sm font-medium"
                    >
                      Back to login
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">Enter your email and we&apos;ll send you a reset link.</p>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                        className="flex-1 py-2 bg-gray-700 text-white rounded-sm hover:bg-gray-600 text-sm font-medium"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (forgotEmail.trim()) {
                            setForgotSent(true);
                          }
                        }}
                        className="flex-1 py-2 bg-gradient-to-r from-teal-400 via-sky-500 to-fuchsia-500 text-white rounded-sm hover:brightness-110 text-sm font-medium"
                      >
                        Send link
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleLoginSubmit}
                className="rounded-2xl bg-black px-8 py-8 flex flex-col"
              >
              <div className="text-center mb-6">
                <p className="text-xs text-gray-500 mb-2">No algorithms just places</p>
                <h1 className="text-3xl font-light mb-2 tracking-tight text-white">Gazetteer</h1>
                <p className="text-sm text-gray-400">Log in to your account</p>
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                  autoComplete="email"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setLoginError(''); }}
                    className="text-xs text-[#7A8AF0] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                {loginError && <p className="text-xs text-red-500">{loginError}</p>}
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl transition-colors text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginLoading ? 'Logging in…' : 'Log in'}
                </button>
                <p className="text-xs text-center text-gray-400">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setSearchParams({ mode: 'signup', step: '1' });
                    }}
                    className="text-[#7A8AF0] hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </div>
              </form>
            )}
          </div>
        ) : (
        <div
          className="w-full max-w-md mx-auto flex flex-1 flex-col min-h-0 rounded-2xl p-[1.5px] shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
        >
        <form
          onSubmit={
            step === 1
              ? handleAccountSubmit
              : step === 2
                ? handleLocationSubmit
                : step === 3
                  ? handleProfilePictureSubmit
                  : handleInterestsSubmit
          }
          className="rounded-2xl bg-black flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 sm:px-10 pt-4 sm:pt-10 pb-4 sm:pb-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">No algorithms just places</p>
              <h1 
                className="text-2xl sm:text-3xl font-light mb-1 sm:mb-2 tracking-tight relative" 
                style={{ 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#ffffff'
                }}
              >
                <span
                  style={{
                    background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.3) 100%)',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    animation: 'shimmer 3s linear infinite',
                    display: 'inline-block'
                  }}
                >
                  Gazetteer
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6 font-normal">
                {signupStepLabel}
              </p>
              
              {/* Step Indicators */}
              <div className="flex justify-center items-center space-x-2 mb-4 sm:mb-6">
                <div
                  className={`h-1 rounded-full transition-all ${step >= 1 ? '' : 'bg-gray-300'}`}
                  style={step >= 1
                    ? { width: '80px', background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }
                    : { width: '40px' }}
                ></div>
                <div
                  className={`h-1 rounded-full transition-all ${step >= 2 ? '' : 'bg-gray-300'}`}
                  style={step >= 2
                    ? { width: '80px', background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }
                    : { width: '40px' }}
                ></div>
                <div
                  className={`h-1 rounded-full transition-all ${step >= 3 ? '' : 'bg-gray-300'}`}
                  style={step >= 3
                    ? { width: '80px', background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }
                    : { width: '40px' }}
                ></div>
                <div
                  className={`h-1 rounded-full transition-all ${step >= 4 ? '' : 'bg-gray-300'}`}
                  style={step >= 4
                    ? { width: '80px', background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }
                    : { width: '40px' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Scrollable fields */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 sm:px-10 pb-4 space-y-2 sm:space-y-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
        {signupError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {signupError}
          </div>
        )}

        {step === 1 && (
          <>
            {/* Step 1: Account details (email + password) */}
            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-gray-400 mb-2">Account type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('personal')}
                  className={`relative rounded-sm border px-3 py-2 text-xs font-semibold transition-colors ${
                    accountType === 'personal'
                      ? 'border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]'
                      : 'border-white/15 bg-black/30 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-200 ${
                      accountType === 'personal' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                  </span>
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('business')}
                  className={`relative rounded-sm border px-3 py-2 text-xs font-semibold transition-colors ${
                    accountType === 'business'
                      ? 'border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]'
                      : 'border-white/15 bg-black/30 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-200 ${
                      accountType === 'business' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                  </span>
                  Business
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">Business accounts are eligible for local business suggestion cards.</p>
              {signupFieldErrors.accountType && (
                <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.accountType}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                placeholder="Email"
                required
                autoComplete="email"
              />
              {signupFieldErrors.email && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5 px-1">8+ characters, include a number or symbol</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                  placeholder="Password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {signupFieldErrors.password && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.password}</p>}
              {/* Password strength meter */}
              {password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        getPasswordStrength(password) === 0 ? 'w-1/4 bg-red-500' :
                        getPasswordStrength(password) === 1 ? 'w-1/2 bg-orange-500' :
                        getPasswordStrength(password) === 2 ? 'w-3/4 bg-yellow-500' :
                        'w-full bg-green-500'
                      }`}
                    />
                  </div>
                  <span className={`text-xs ${
                    getPasswordStrength(password) === 0 ? 'text-red-400' :
                    getPasswordStrength(password) === 1 ? 'text-orange-400' :
                    getPasswordStrength(password) === 2 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {getPasswordStrength(password) === 0 ? 'Weak' :
                     getPasswordStrength(password) === 1 ? 'Fair' :
                     getPasswordStrength(password) === 2 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                placeholder="Confirm Password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
              {confirmPassword && (
                <p className={`text-xs mt-1.5 px-1 ${password === confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                  {password === confirmPassword ? 'Passwords match' : 'Passwords don\'t match'}
                </p>
              )}
              {signupFieldErrors.confirmPassword && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.confirmPassword}</p>}
            </div>

            <label className="flex items-start gap-2 px-1 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black shrink-0"
              />
              <span>
                I accept{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#7A8AF0] hover:underline">
                  Terms & Conditions
                </Link>
              </span>
            </label>
            {signupFieldErrors.terms && <p className="text-xs text-red-400 px-1">{signupFieldErrors.terms}</p>}

            <label className="flex items-start gap-2 px-1 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={acceptedGuidelines}
                onChange={(e) => setAcceptedGuidelines(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black shrink-0"
              />
              <span>
                I accept{' '}
                <Link to="/terms#community-guidelines" target="_blank" rel="noopener noreferrer" className="text-[#7A8AF0] hover:underline">
                  Community Guidelines
                </Link>
              </span>
            </label>
            {signupFieldErrors.guidelines && <p className="text-xs text-red-400 px-1">{signupFieldErrors.guidelines}</p>}

          </>
        )}

        {step === 2 && (
          <>
            {/* Step 2: Location Selection */}
            {/* Name Input */}
            <div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                placeholder="Full Name"
                required
                autoComplete="name"
              />
              {signupFieldErrors.name && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.name}</p>}
            </div>

            {/* Date of Birth - required, 13+ */}
            <div>
              <p className="text-xs text-gray-400 mb-2 px-1">Date of birth (you must be 13 or older)</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5 relative">
                  <select
                    value={birthMonth}
                    onChange={e => setBirthMonth(e.target.value)}
                    className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-8 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-white appearance-none"
                    required
                  >
                    <option value="">Month</option>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={birthDay}
                    onChange={e => setBirthDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="Day"
                    className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                    maxLength={2}
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={birthYear}
                    onChange={e => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Year"
                    className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                    maxLength={4}
                  />
                </div>
              </div>
              {signupFieldErrors.birthdate && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.birthdate}</p>}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2 px-1">Your home area for news feeds</p>
              <PlaceAutocompleteField
                value={homeLocationQuery}
                onChange={(v) => {
                  setHomeLocationQuery(v);
                  if (local || regional || national) {
                    setLocal('');
                    setRegional('');
                    setNational('');
                  }
                }}
                onSelectSuggestion={applyHomeLocation}
                mode="location"
                showIcon
                showFeedLevels
                placeholder="Search city or neighborhood…"
                inputClassName={`${signupPlaceInputClass} pl-10`}
              />
              <p className="mt-1.5 text-[11px] text-gray-500 px-1">Type at least 2 characters, then pick a place from the list.</p>
              {signupFieldErrors.homeLocation && (
                <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.homeLocation}</p>
              )}
              {homeLocationComplete && (
                <div className="mt-2 rounded-xl border border-[#8ab4ff]/25 bg-[#8ab4ff]/8 px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] text-[#dce9ff] flex items-center gap-1.5">
                    <FiCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Home area saved — country, city, and local news feeds
                  </p>
                  {signupFeedTierRows(local, regional, national).map((row) => (
                    <p key={row.label} className="text-xs text-gray-200 flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-400">{row.label}:</span>
                      {row.label === 'Country' && previewCountryFlag ? (
                        <Flag value={previewCountryFlag} national={national} size={14} />
                      ) : null}
                      <span>{row.value}</span>
                    </p>
                  ))}
                  <button type="button" onClick={clearHomeLocation} className="mt-1 text-[11px] text-[#7A8AF0] hover:underline">Change location</button>
                </div>
              )}
            </div>

            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-gray-400">Your handle on posts</p>
              <p className="text-sm text-white font-medium flex items-center gap-1.5 mt-0.5">
                <span>@{handlePreview}</span>
                {previewCountryFlag ? <Flag value={previewCountryFlag} national={national} size={16} /> : null}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">Country flag is set from your national feed area.</p>
            </div>

            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-gray-400 mb-2">Preferred locations for suggestions (optional)</p>
              <PlaceAutocompleteField
                value={preferredLocationQuery}
                onChange={setPreferredLocationQuery}
                onSelectSuggestion={addPreferredLocation}
                mode="location"
                showIcon
                placeholder="Search places you follow…"
                inputClassName={`${signupPlaceInputClass} pl-10`}
              />
              {preferredLocations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferredLocations.map((place) => (
                    <span
                      key={place}
                      className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-gray-200"
                    >
                      {place}
                      <button
                        type="button"
                        onClick={() => removePreferredLocation(place)}
                        className="text-gray-400 hover:text-white"
                        aria-label={`Remove ${place}`}
                      >
                        <FiX className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-gray-500">
                {preferredLocations.length}/12 added. Pick from suggestions — same search as Discover.
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 mb-1">
              <p className="text-[11px] text-gray-400">Signing up as</p>
              <p className="text-sm text-white font-medium flex items-center gap-1.5 mt-0.5">
                <span>@{handlePreview}</span>
                {previewCountryFlag ? <Flag value={previewCountryFlag} national={national} size={16} /> : null}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">{local} · {regional} · {national}</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-4">
              <p className="text-[11px] text-gray-400 mb-3">Profile picture (optional)</p>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-800 border border-white/20 flex items-center justify-center text-xs text-gray-200">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    (name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U')
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/25 px-3 py-2 text-xs text-white hover:bg-white/5">
                  Choose photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureSelect} />
                </label>
                {profilePicture && (
                  <button
                    type="button"
                    onClick={() => setProfilePicture(null)}
                    className="rounded-xl border border-white/20 px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Your initials are used if no photo is selected.</p>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-gray-400">Almost done</p>
              <p className="text-sm text-white font-medium flex items-center gap-1.5 mt-0.5">
                <span>@{handlePreview}</span>
                {previewCountryFlag ? <Flag value={previewCountryFlag} national={national} size={16} /> : null}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">{name.trim() || 'Your name'} · {local}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-4">
              <h2 className="text-sm font-medium text-white mb-1">Your interests</h2>
              <p className="text-xs text-gray-400 mb-3">Select up to 5 interests to personalize your feed (optional).</p>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        selected
                          ? 'border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]'
                          : 'border-white/20 text-gray-300 hover:border-white/40'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
              {interests.length > 0 && (
                <p className="mt-3 text-[11px] text-gray-500">
                  {interests.length} of 5 selected
                </p>
              )}
            </div>
          </>
        )}

          </div>

          <div className="flex-shrink-0 border-t border-gray-700 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
              <button
                type="submit"
                disabled={
                  signupSubmitting ||
                  (step === 1 && !step1CanContinue) ||
                  (step === 2 && !step2CanContinue)
                }
                className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl transition-colors text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signupSubmitting
                  ? 'Creating account…'
                  : step < 4
                    ? 'Continue'
                    : 'Create account'}
              </button>
              
              {step > 1 && (
                <button
                  type="button"
                  disabled={signupSubmitting}
                  onClick={() => updateStep(step - 1)}
                  className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold border border-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              )}

              <p className="text-xs text-center text-gray-400 mt-4">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setSearchParams({ mode: 'login' });
                  }}
                  className="text-[#7A8AF0] hover:underline font-medium"
                >
                  Log in
                </button>
              </p>
              <div className="mt-1 space-y-1.5">
                <p className="text-[11px] text-center text-gray-500">
                  By signing up, you confirm that you are at least 13 years old and agree to our Terms and Conditions and Community Guidelines.
                </p>
                <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400">
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-[#7A8AF0]"
                  >
                    <FiFileText className="w-3.5 h-3.5" />
                    <span>Terms</span>
                  </Link>
                  <Link
                    to="/terms#community-guidelines"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-[#7A8AF0]"
                  >
                    <FiShield className="w-3.5 h-3.5" />
                    <span>Community Guidelines</span>
                  </Link>
                </div>
              </div>
          </div>
      </form>
      </div>
        )}
      </div>
    </div>
  );
}
