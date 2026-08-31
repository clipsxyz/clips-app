import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiEye, FiEyeOff, FiFileText, FiShield, FiCheck } from 'react-icons/fi';
import { loginUser, registerUser, mapLaravelUserToAppFields, requestPasswordResetCode, resetPasswordWithCode, uploadFile, updateAuthProfile } from '../api/client';
import { isMockMode } from '../api/apiMode';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion, signupFeedTierRows } from '../utils/placeFeedLevels';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
import Flag from '../components/Flag';
import { consumePublicShareReturnPath } from '../utils/publicShare';
import { persistAuthToken } from '../utils/authTokenBridge';
import { setAvatarForHandle } from '../api/users';
import { clearLaravelUnreachable } from '../config/runtimeEnv';
import { db } from '../utils/db';
import { buildGazetteerHandle } from '../utils/gazetteerHandle';

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

/** Strip huge base64 blobs ? they belong in IndexedDB, not localStorage. */
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
    const inviteParam = (searchParams.get('invite') || '').replace(/^@/, '').trim();
    if (inviteParam) {
      try {
        sessionStorage.setItem('clips:inviteHandle', inviteParam);
      } catch {
        // ignore storage failures
      }
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
  const step = (stepFromUrl >= 1 && stepFromUrl <= 3) ? stepFromUrl : 1;

  const signupStepTitle =
    step === 1 ? 'Create your account' : step === 2 ? 'About you' : 'Add a photo';

  const signupInputClass =
    'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7A8AF0]/60 focus:ring-1 focus:ring-[#7A8AF0]/30';

  // Helper function to update step (updates both state and URL)
  const updateStep = React.useCallback((newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
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

  // Forgot password (same Laravel local reset as the native app)
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotStep, setForgotStep] = React.useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotCode, setForgotCode] = React.useState('');
  const [forgotDebugCode, setForgotDebugCode] = React.useState('');
  const [forgotPassword, setForgotPassword] = React.useState('');
  const [forgotConfirm, setForgotConfirm] = React.useState('');
  const [forgotError, setForgotError] = React.useState('');
  const [forgotLoading, setForgotLoading] = React.useState(false);

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

  const signupPlaceInputClass = `${signupInputClass} pl-10`;

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
      nextErrors.homeLocation =
        'Search and pick a place from the list ? we need your local, regional, and national feeds.';
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

  async function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupFieldErrors({});
    setSignupError('');
    setSignupSubmitting(true);
    const age = getAgeFromBirthday();
    const consentTimestamp = new Date().toISOString();
    const handle = buildGazetteerHandle(name.trim() || 'user', regional);
    const userId = email.trim().toLowerCase();
    const userData = {
      id: userId,
      name: name.trim(),
      email: email.trim(),
      password: password,
      age: age ?? undefined,
      interests,
      local: local.trim(),
      regional: regional.trim(),
      national: national.trim(),
      handle,
      countryFlag: normalizeCountryFlagInput('', national),
      avatarUrl: profilePicture || undefined,
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
      const inviteHandle =
        (searchParams.get('invite') || '').replace(/^@/, '').trim() ||
        (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('clips:inviteHandle') || '').replace(/^@/, '').trim() : '');
      const apiResponse = await registerUser({
        username: email.trim().split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
        email: email.trim(),
        password,
        displayName: name.trim(),
        handle,
        locationLocal: local.trim(),
        locationRegional: regional.trim(),
        locationNational: national.trim(),
        accountType: (accountType ?? 'personal') as 'personal' | 'business',
        isBusiness: accountType === 'business',
        inviteHandle: inviteHandle || undefined,
      });
      const token = apiResponse?.token;
      if (token) await persistAuthToken(token);
      try {
        sessionStorage.removeItem('clips:inviteHandle');
      } catch {
        // ignore
      }
      const mapped = mapLaravelUserToAppFields(apiResponse?.user || {});
      let hostedAvatar = (mapped.avatarUrl as string | undefined) || undefined;
      if (profilePicture && /^data:/i.test(profilePicture)) {
        try {
          const blob = await (await fetch(profilePicture)).blob();
          const file = new File([blob], 'profile-avatar.jpg', { type: blob.type || 'image/jpeg' });
          const uploaded = await uploadFile(file);
          const remote = String((uploaded as { fileUrl?: string; url?: string })?.fileUrl || (uploaded as { url?: string })?.url || '').trim();
          if (remote) {
            let persistUrl = remote;
            try {
              const parsed = new URL(remote);
              if (parsed.pathname.startsWith('/storage/')) persistUrl = parsed.pathname;
            } catch {
              /* already relative */
            }
            await updateAuthProfile({ avatar_url: persistUrl });
            hostedAvatar = persistUrl;
            setAvatarForHandle(handle, persistUrl);
          }
        } catch (avatarErr) {
          console.warn('[signup] profile photo did not upload to Laravel', avatarErr);
        }
      }
      const mergedUser = {
        ...userData,
        id: mapped.id ?? userData.id,
        handle: String(mapped.handle || userData.handle),
        name: String(mapped.name || userData.name),
        local: String(mapped.local || userData.local),
        regional: String(mapped.regional || userData.regional),
        national: String(mapped.national || userData.national),
        avatarUrl: hostedAvatar || userData.avatarUrl,
        accountType: (mapped.accountType as 'personal' | 'business') || userData.accountType,
        is_private: mapped.is_private,
      };
      login(mergedUser);
      saveLocalRegistration(email.trim(), password, mergedUser);
      nav(getPostAuthRedirect(), { replace: true, state: { fromSignup: true } });
      return;
    } catch (err: unknown) {
      if (!isMockMode()) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        const isConnection =
          message.includes('CONNECTION_REFUSED') ||
          (err instanceof Error && err.name === 'ConnectionRefused');
        setSignupError(
          isConnection
            ? 'Cannot reach the server. Check Laravel is running and try again.'
            : message,
        );
        setSignupSubmitting(false);
        return;
      }
      // Mock mode: keep local registration fallback
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
    clearLaravelUnreachable();
    try {
      const res = await loginUser(loginEmail.trim().replace(/^@+/, ''), loginPassword);
      const token = (res as { token?: string }).token;
      const apiUser = (res as { user?: any }).user;
      if (token) await persistAuthToken(token);
      if (apiUser) {
        const mapped = mapLaravelUserToAppFields(apiUser);
        const userData = {
          id: mapped.id,
          name: mapped.name || apiUser.display_name || apiUser.name || apiUser.username || '',
          email: mapped.email || apiUser.email || '',
          handle: mapped.handle || apiUser.handle || '',
          local: mapped.local || apiUser.location_local || '',
          regional: mapped.regional || apiUser.location_regional || '',
          national: mapped.national || apiUser.location_national || '',
          avatarUrl: mapped.avatarUrl || apiUser.avatar_url,
          is_private: mapped.is_private || apiUser.is_private || false,
          accountType:
            mapped.accountType === 'business' ||
            apiUser.account_type === 'business' ||
            apiUser.accountType === 'business' ||
            apiUser.is_business === true
              ? 'business'
              : 'personal',
        };
        login(userData);
        nav(getPostAuthRedirect(), { replace: true });
        return;
      }
      setLoginError('Login succeeded but the server did not return a user session.');
    } catch (err: any) {
      // Live Laravel: seeded users are not in localStorage. Do not treat a miss as "backend down".
      if (!isMockMode()) {
        const msg = String(err?.message || 'Login failed');
        const isConnection =
          err?.name === 'ConnectionRefused' ||
          msg === 'CONNECTION_REFUSED' ||
          msg.includes('Failed to fetch') ||
          msg.includes('ERR_CONNECTION_REFUSED');
        if (isConnection) {
          setLoginError('Cannot reach the server. Check Laravel is running and try again.');
        } else {
          setLoginError('Invalid email or password.');
        }
        return;
      }

      const isConnectionError =
        err?.message === 'CONNECTION_REFUSED' ||
        err?.name === 'ConnectionRefused' ||
        err?.message?.includes('Failed to fetch');
      const key = loginEmail.trim().toLowerCase();
      const localReg = getLocalRegistrations();
      const stored = localReg[key];
      if (stored && stored.password === loginPassword) {
        login(stored.userData);
        nav(getPostAuthRedirect(), { replace: true });
        return;
      }
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

  async function handleForgotSendCode(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    const identifier = forgotEmail.trim();
    if (!identifier) {
      setForgotError('Enter your email or handle.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await requestPasswordResetCode(identifier);
      setForgotDebugCode(String(res.debug_code || ''));
      if (res.debug_code) setForgotCode(String(res.debug_code));
      setForgotStep(2);
    } catch (err: any) {
      const msg = String(err?.message || 'Could not send code');
      const isConnection =
        err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
      setForgotError(
        isConnection
          ? 'Cannot reach the server. Check Laravel is running.'
          : msg,
      );
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    const identifier = forgotEmail.trim();
    const code = forgotCode.replace(/\D/g, '');
    if (!identifier) {
      setForgotError('Enter your email or handle.');
      return;
    }
    if (code.length !== 6) {
      setForgotError('Enter the 6-digit code.');
      return;
    }
    if (forgotPassword.length < 8) {
      setForgotError('New password must be at least 8 characters.');
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await resetPasswordWithCode(identifier, code, forgotPassword);
      if (res.token) await persistAuthToken(res.token);
      const mapped = mapLaravelUserToAppFields(res.user || {});
      login({
        id: mapped.id,
        name: mapped.name || identifier.split('@')[0] || 'User',
        email: mapped.email || identifier,
        handle: mapped.handle,
        local: mapped.local,
        regional: mapped.regional,
        national: mapped.national,
        avatarUrl: mapped.avatarUrl,
        is_private: mapped.is_private,
        accountType: mapped.accountType,
      });
      nav(getPostAuthRedirect(), { replace: true });
    } catch (err: any) {
      const msg = String(err?.message || 'Could not reset password');
      const isConnection =
        err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
      setForgotError(
        isConnection
          ? 'Cannot reach the server. Check Laravel is running.'
          : msg,
      );
    } finally {
      setForgotLoading(false);
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
      <div className="w-full flex-1 flex flex-col min-h-0">
        {mode === 'login' ? (
          <div
            className="max-w-md mx-auto rounded-2xl p-0.5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
          >
            {showForgotPassword ? (
              <form
                onSubmit={forgotStep === 1 ? handleForgotSendCode : handleForgotSubmit}
                className="rounded-2xl bg-black px-8 py-8 flex flex-col"
              >
                <div className="text-center mb-6">
                  <p className="text-xs text-gray-500 mb-2">Recovery</p>
                  <h1 className="text-2xl font-light mb-2 tracking-tight text-white">
                    {forgotStep === 1 ? 'Forgot password' : 'Enter code'}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {forgotStep === 1
                      ? 'We’ll send a 6-digit code. Without Mailgun it shows here.'
                      : forgotDebugCode
                        ? `No email yet — your code is ${forgotDebugCode}`
                        : 'Enter the 6-digit code, then choose a new password.'}
                  </p>
                </div>
                <div className="space-y-3">
                  {forgotStep === 1 ? (
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="Email or handle"
                      className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={forgotCode}
                        onChange={e => setForgotCode(e.target.value)}
                        placeholder="6-digit code"
                        className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                        autoFocus
                      />
                      <input
                        type="password"
                        value={forgotPassword}
                        onChange={e => setForgotPassword(e.target.value)}
                        placeholder="New password (8+ characters)"
                        className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      />
                      <input
                        type="password"
                        value={forgotConfirm}
                        onChange={e => setForgotConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      />
                    </>
                  )}
                  {forgotError ? <p className="text-xs text-red-500">{forgotError}</p> : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (forgotStep === 2) {
                          setForgotStep(1);
                          setForgotError('');
                          return;
                        }
                        setShowForgotPassword(false);
                        setForgotEmail('');
                        setForgotCode('');
                        setForgotDebugCode('');
                        setForgotPassword('');
                        setForgotConfirm('');
                        setForgotError('');
                      }}
                      className="flex-1 py-2 bg-gray-700 text-white rounded-sm hover:bg-gray-600 text-sm font-medium"
                    >
                      {forgotStep === 2 ? 'Back' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2 bg-gradient-to-r from-teal-400 via-sky-500 to-fuchsia-500 text-white rounded-sm hover:brightness-110 text-sm font-medium disabled:opacity-50"
                    >
                      {forgotLoading
                        ? 'Please wait…'
                        : forgotStep === 1
                          ? 'Send code'
                          : 'Save and log in'}
                    </button>
                  </div>
                </div>
              </form>
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
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="Email or handle"
                  className={signupInputClass}
                  autoComplete="username"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Password (8+ characters)"
                    className={`${signupInputClass} pr-10`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotStep(1);
                      setForgotEmail(loginEmail.trim());
                      setForgotCode('');
                      setForgotDebugCode('');
                      setForgotPassword('');
                      setForgotConfirm('');
                      setForgotError('');
                      setLoginError('');
                    }}
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
                  {loginLoading ? 'Logging in?' : 'Log in'}
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
        <form
          onSubmit={
            step === 1
              ? handleAccountSubmit
              : step === 2
                ? handleLocationSubmit
                : handleProfilePictureSubmit
          }
          className="flex flex-1 flex-col min-h-0 w-full h-full overflow-hidden bg-black"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 sm:px-10 pt-6 sm:pt-10 pb-2">
            <div className="mx-auto w-full max-w-[400px] text-center">
              {step === 1 && (
                <p className="text-xs text-gray-500 mb-3">No algorithms just places</p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {step === 1 ? (
                  <span
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.35) 100%)',
                      backgroundSize: '200% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'shimmer 3s linear infinite',
                      display: 'inline-block',
                    }}
                  >
                    Gazetteer
                  </span>
                ) : (
                  'Gazetteer'
                )}
              </h1>
              <h2 className="mt-3 text-lg font-medium text-white">{signupStepTitle}</h2>
              <div className="mx-auto mt-5 mb-1 h-0.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#7A8AF0] transition-all duration-300 ease-out"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable fields */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="mx-auto w-full max-w-[400px] space-y-4 px-6 sm:px-10 pb-28">
        {signupError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {signupError}
          </div>
        )}

        {step === 1 && (
          <>
            {/* Step 1: Account details (email + password) */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Account type</p>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setAccountType('personal')}
                  className={`relative rounded-md px-3 py-2.5 text-xs font-semibold transition-colors ${
                    accountType === 'personal'
                      ? 'bg-[#7A8AF0]/20 text-white'
                      : 'text-gray-400 hover:text-gray-200'
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
                  className={`relative rounded-md px-3 py-2.5 text-xs font-semibold transition-colors ${
                    accountType === 'business'
                      ? 'bg-[#7A8AF0]/20 text-white'
                      : 'text-gray-400 hover:text-gray-200'
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
              {accountType === 'business' && (
                <p className="text-xs text-gray-500">Eligible for local business suggestion cards.</p>
              )}
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
                className={signupInputClass}
                placeholder="Email"
                required
                autoComplete="email"
              />
              {signupFieldErrors.email && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${signupInputClass} pr-10`}
                  placeholder="Password (8+ characters)"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300"
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
                className={`${signupInputClass} pr-10`}
                placeholder="Confirm Password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300"
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
                className={signupInputClass}
                placeholder="Full Name"
                required
                autoComplete="name"
              />
              {signupFieldErrors.name && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.name}</p>}
            </div>

            {/* Date of Birth - required, 13+ */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Date of birth</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5 relative">
                  <select
                    value={birthMonth}
                    onChange={e => setBirthMonth(e.target.value)}
                    className={`${signupInputClass} pr-8 appearance-none`}
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
                    className={signupInputClass}
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
                    className={signupInputClass}
                    maxLength={4}
                  />
                </div>
              </div>
              {signupFieldErrors.birthdate && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.birthdate}</p>}
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Home location ? local, regional, and national feeds.
              </p>
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
                placeholder="Search city or neighborhood"
                inputClassName={signupPlaceInputClass}
              />
              {!homeLocationComplete && homeLocationQuery.trim().length >= 2 && (
                <p className="mt-1.5 text-xs text-amber-300/90">
                  Select a suggestion from the list.
                </p>
              )}
              {signupFieldErrors.homeLocation && (
                <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.homeLocation}</p>
              )}
              {homeLocationComplete && (
                <div className="mt-2 flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7A8AF0]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-white">Home area set</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {signupFeedTierRows(local, regional, national)
                        .map((row) => row.value)
                        .join(' ? ')}
                    </p>
                    <button
                      type="button"
                      onClick={clearHomeLocation}
                      className="mt-1 text-xs text-[#7A8AF0] hover:underline"
                    >
                      Change location
                    </button>
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        {step === 3 && (
          <>
            <p className="text-center text-sm text-gray-400">
              <span className="font-medium text-white">@{handlePreview}</span>
              {previewCountryFlag ? (
                <span className="ml-1.5 inline-flex align-middle">
                  <Flag value={previewCountryFlag} national={national} size={16} />
                </span>
              ) : null}
              <span className="mt-1 block truncate text-xs text-gray-500">
                {[local, regional, national].filter(Boolean).join(' ? ')}
              </span>
            </p>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/5 text-lg text-gray-200">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5">
                  Choose photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureSelect} />
                </label>
                {profilePicture && (
                  <button
                    type="button"
                    onClick={() => setProfilePicture(null)}
                    className="rounded-lg px-4 py-2.5 text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-gray-500">Optional ? initials are used if you skip.</p>
            </div>
          </>
        )}

            </div>
          </div>

          <div className="flex-shrink-0 border-t border-white/10 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.65)]">
            <div className="mx-auto w-full max-w-[400px] space-y-3">
              {step === 1 && (
                <div className="space-y-2.5 rounded-lg border border-white/15 bg-white/5 px-3 py-3">
                  <p className="text-xs font-medium text-gray-300">Required to continue</p>
                  <label className="flex items-start gap-2.5 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-black accent-[#7A8AF0]"
                    />
                    <span>
                      I accept{' '}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#7A8AF0] hover:underline">
                        Terms & Conditions
                      </Link>
                    </span>
                  </label>
                  {signupFieldErrors.terms && <p className="text-xs text-red-400">{signupFieldErrors.terms}</p>}
                  <label className="flex items-start gap-2.5 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={acceptedGuidelines}
                      onChange={(e) => setAcceptedGuidelines(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-black accent-[#7A8AF0]"
                    />
                    <span>
                      I accept{' '}
                      <Link
                        to="/terms#community-guidelines"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7A8AF0] hover:underline"
                      >
                        Community Guidelines
                      </Link>
                    </span>
                  </label>
                  {signupFieldErrors.guidelines && <p className="text-xs text-red-400">{signupFieldErrors.guidelines}</p>}
                  {!step1CanContinue && (email || password) && (!acceptedTerms || !acceptedGuidelines) && (
                    <p className="text-xs text-amber-300/90">Accept both above to enable Continue.</p>
                  )}
                </div>
              )}
              {step > 1 && (
                <button
                  type="button"
                  disabled={signupSubmitting}
                  onClick={() => updateStep(step - 1)}
                  className="w-full py-2 text-sm text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={
                  signupSubmitting ||
                  (step === 1 && !step1CanContinue) ||
                  (step === 2 && !step2CanContinue)
                }
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/50"
              >
                {signupSubmitting
                  ? 'Creating account?'
                  : step < 3
                    ? 'Continue'
                    : 'Create account'}
              </button>

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
              {step === 1 ? (
                <p className="text-center text-[11px] text-gray-500">You must be at least 13 years old.</p>
              ) : (
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
              )}
            </div>
          </div>
      </form>
        )}
      </div>
    </div>
  );
}
