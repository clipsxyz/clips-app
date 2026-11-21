import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiEye, FiEyeOff, FiFileText, FiShield, FiCheck } from 'react-icons/fi';
import { loginUser, registerUser, checkSignupAvailability, mapLaravelUserToAppFields, requestPasswordResetCode, resetPasswordWithCode, uploadFile, updateAuthProfile } from '../api/client';
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
import { buildGazetteerHandle, businessUsernameFromName, sanitizeSignupUsernameInput, validateSignupUsername } from '../utils/gazetteerHandle';
import { signupPasswordIssue } from '../utils/signupPassword';

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
  const step = (stepFromUrl >= 1 && stepFromUrl <= 8) ? stepFromUrl : 1;

  const signupInputClass =
    'w-full rounded-lg border border-white/25 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-[#7A8AF0]/80 focus:ring-1 focus:ring-[#7A8AF0]/40';

  // Helper function to update step (updates both state and URL)
  const updateStep = React.useCallback((newStep: number) => {
    if (newStep >= 1 && newStep <= 8) {
      setSignupError('');
      setSearchParams({ mode: 'signup', step: newStep.toString() });
    }
  }, [setSearchParams]);

  // Step 2: Profile & location
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [local, setLocal] = React.useState('');
  const [regional, setRegional] = React.useState('');
  const [national, setNational] = React.useState('');
  const [homeLocationQuery, setHomeLocationQuery] = React.useState('');
  const [showManualPlace, setShowManualPlace] = React.useState(false);

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

  const isBusinessAccount = accountType === 'business';
  const signupScreens = isBusinessAccount
    ? (['type', 'email', 'password', 'name', 'birthday', 'place', 'photo'] as const)
    : (['type', 'email', 'password', 'name', 'birthday', 'place', 'username', 'photo'] as const);
  const signupScreen = signupScreens[Math.min(step, signupScreens.length) - 1];
  const signupStepTitle =
    signupScreen === 'type'
      ? 'Create your account'
      : signupScreen === 'email'
        ? 'Email'
        : signupScreen === 'password'
          ? 'Password'
          : signupScreen === 'name'
            ? isBusinessAccount
              ? 'Business name'
              : 'Your name'
            : signupScreen === 'birthday'
              ? 'Date of birth'
              : signupScreen === 'place'
                ? isBusinessAccount
                  ? 'Where is the business?'
                  : 'Customise your location feeds'
                : signupScreen === 'username'
                  ? 'Username'
                  : 'Add a photo';
  const businessUsername = businessUsernameFromName(name);
  const signupUsername = isBusinessAccount ? businessUsername : sanitizeSignupUsernameInput(username);
  const usernameForHandle = signupUsername || (isBusinessAccount ? 'business' : 'yourname');
  const handlePreview = regional
    ? buildGazetteerHandle(usernameForHandle, regional)
    : buildGazetteerHandle(usernameForHandle, 'yourregion');
  const previewCountryFlag = normalizeCountryFlagInput('', national);
  const homeLocationComplete = Boolean(local && regional && national);
  const birthdateComplete = React.useMemo(() => {
    const age = getAgeFromBirthday();
    return age !== null && age >= MIN_AGE;
  }, [birthMonth, birthDay, birthYear]);
  const step2CanContinue = Boolean(
    name.trim() &&
      !(isBusinessAccount
        ? name.trim() && businessUsername.length < 3
        : validateSignupUsername(username)) &&
      birthdateComplete,
  );
  const step3CanContinue = homeLocationComplete;
  const step1CanContinue =
    Boolean(accountType && email.trim() && password.length >= 8 && password === confirmPassword && acceptedTerms && acceptedGuidelines);

  function applyHomeLocation(suggestion: LocationSuggestion) {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    setLocal(parsed.local);
    setRegional(parsed.regional);
    setNational(parsed.national);
    setHomeLocationQuery(parsed.fullName || suggestion.name);
    setShowManualPlace(false);
  }

  function clearHomeLocation() {
    setLocal('');
    setRegional('');
    setNational('');
    setHomeLocationQuery('');
    setShowManualPlace(false);
  }

  function signupConnectionMessage(err: any, fallback: string) {
    const msg = String(err?.message || '');
    const isConnection = err?.name === 'ConnectionRefused' || msg.includes('CONNECTION_REFUSED');
    return isConnection ? 'Cannot reach the server. Check Laravel is running and try again.' : msg || fallback;
  }

  async function checkUsernameFree(cleanUsername: string, field: 'name' | 'username') {
    const availability = await checkSignupAvailability({ username: cleanUsername });
    if (availability.username_taken) {
      const taken = field === 'name' ? 'This name is already taken. Try another.' : 'This username is already taken. Try another.';
      setSignupFieldErrors({ [field]: taken });
      setSignupError('Please choose a different username.');
      return false;
    }
    if (availability.errors?.username?.[0]) {
      setSignupFieldErrors({ username: availability.errors.username[0] });
      setSignupError('Please fix the highlighted fields.');
      return false;
    }
    return true;
  }

  async function handleSignupContinue(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    if (signupScreen === 'photo') {
      await handleProfilePictureSubmit(e);
      return;
    }
    setSignupFieldErrors({});
    setSignupError('');
    if (signupScreen === 'type') {
      if (!accountType) {
        setSignupError('Choose Creator or Business.');
        return;
      }
      updateStep(step + 1);
      return;
    }
    if (signupScreen === 'email') {
      if (!email.trim()) {
        setSignupFieldErrors({ email: 'Email is required.' });
        setSignupError('Enter your email.');
        return;
      }
      setSignupSubmitting(true);
      try {
        const availability = await checkSignupAvailability({ email: email.trim() });
        if (availability.email_taken) {
          setSignupFieldErrors({ email: 'This email is already taken. Try logging in instead.' });
          setSignupError('This email is already registered.');
          return;
        }
        if (availability.errors?.email?.[0]) {
          setSignupFieldErrors({ email: availability.errors.email[0] });
          setSignupError('Please fix the highlighted fields.');
          return;
        }
        setAcceptedTerms(true);
        setAcceptedGuidelines(true);
        updateStep(step + 1);
      } catch (err: any) {
        setSignupError(signupConnectionMessage(err, 'Could not verify email. Try again.'));
      } finally {
        setSignupSubmitting(false);
      }
      return;
    }
    if (signupScreen === 'password') {
      const issue = signupPasswordIssue(password);
      if (issue) {
        setSignupFieldErrors({ password: issue });
        setSignupError(issue);
        return;
      }
      setConfirmPassword(password);
      updateStep(step + 1);
      return;
    }
    if (signupScreen === 'name') {
      if (!name.trim()) {
        setSignupFieldErrors({ name: isBusinessAccount ? 'Business name is required.' : 'Full name is required.' });
        setSignupError('Enter a name.');
        return;
      }
      if (isBusinessAccount && businessUsername.length < 3) {
        setSignupFieldErrors({ name: 'Use a business name with at least 3 letters or numbers.' });
        setSignupError('Use a business name with at least 3 letters or numbers.');
        return;
      }
      if (isBusinessAccount) {
        setSignupSubmitting(true);
        try {
          const free = await checkUsernameFree(businessUsername, 'name');
          if (free) updateStep(step + 1);
        } catch (err: any) {
          setSignupError(signupConnectionMessage(err, 'Could not verify that name. Try again.'));
        } finally {
          setSignupSubmitting(false);
        }
        return;
      }
      updateStep(step + 1);
      return;
    }
    if (signupScreen === 'birthday') {
      if (!birthMonth || !birthDay || !birthYear) {
        setSignupFieldErrors({ birthdate: 'Please enter your date of birth.' });
        setSignupError('Enter your date of birth.');
        return;
      }
      const age = getAgeFromBirthday();
      if (age === null) {
        setSignupFieldErrors({ birthdate: 'Please enter a valid date of birth.' });
        setSignupError('Enter a valid date of birth.');
        return;
      }
      if (age < MIN_AGE) {
        setSignupFieldErrors({ birthdate: `You must be at least ${MIN_AGE} years old.` });
        setSignupError(`You must be at least ${MIN_AGE} years old.`);
        return;
      }
      updateStep(step + 1);
      return;
    }
    if (signupScreen === 'place') {
      if (!homeLocationComplete) {
        setSignupFieldErrors({
          homeLocation: showManualPlace
            ? 'Enter your town, county or region, and country.'
            : 'Search and pick a place from the list.',
        });
        setSignupError('Choose the place for your news feed.');
        return;
      }
      updateStep(step + 1);
      return;
    }
    if (signupScreen === 'username') {
      const usernameError = validateSignupUsername(username);
      if (usernameError) {
        setSignupFieldErrors({ username: usernameError });
        setSignupError(usernameError);
        return;
      }
      setSignupSubmitting(true);
      try {
        const free = await checkUsernameFree(sanitizeSignupUsernameInput(username), 'username');
        if (free) updateStep(step + 1);
      } catch (err: any) {
        setSignupError(signupConnectionMessage(err, 'Could not verify username. Try again.'));
      } finally {
        setSignupSubmitting(false);
      }
    }
  }

  async function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupFieldErrors({});
    setSignupError('');
    setSignupSubmitting(true);
    const age = getAgeFromBirthday();
    const consentTimestamp = new Date().toISOString();
    const cleanUsername = isBusinessAccount ? businessUsernameFromName(name) : sanitizeSignupUsernameInput(username);
    const handle = buildGazetteerHandle(cleanUsername || 'user', regional);
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
        username: cleanUsername,
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
        const responseErrors = (err as any)?.response?.errors || {};
        const emailErr = Array.isArray(responseErrors.email)
          ? String(responseErrors.email[0] || '')
          : '';
        const usernameErr = Array.isArray(responseErrors.username)
          ? String(responseErrors.username[0] || '')
          : '';
        const handleErr = Array.isArray(responseErrors.handle)
          ? String(responseErrors.handle[0] || '')
          : '';
        if (/email/i.test(emailErr) || /email.*(taken|unique|already)/i.test(message)) {
          updateStep(1);
          setSignupFieldErrors({
            email: emailErr || 'This email is already taken. Try logging in instead.',
          });
          setSignupError('This email is already registered.');
        } else if (
          /username/i.test(usernameErr) ||
          /username.*(taken|unique|already)/i.test(message) ||
          /handle.*(taken|unique|already)/i.test(handleErr) ||
          /handle.*(taken|unique|already)/i.test(message)
        ) {
          updateStep(2);
          setSignupFieldErrors({
            username: usernameErr || handleErr || 'This username is already taken. Try another.',
          });
          setSignupError('Please choose a different username.');
        } else {
          setSignupError(
            isConnection
              ? 'Cannot reach the server. Check Laravel is running and try again.'
              : message,
          );
        }
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
        background: 'linear-gradient(180deg, #000000 0%, #23104F 100%)',
        backgroundColor: '#000000',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full flex-1 flex flex-col min-h-0">
        {mode === 'login' ? (
          <div
            className="max-w-md mx-auto w-full rounded-2xl border border-white/10 bg-black/25 shadow-lg backdrop-blur-sm"
          >
            {showForgotPassword ? (
              <form
                onSubmit={forgotStep === 1 ? handleForgotSendCode : handleForgotSubmit}
                className="rounded-2xl px-8 py-8 flex flex-col"
                style={{ backgroundColor: 'transparent' }}
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
                      className={signupInputClass}
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
                        className={signupInputClass}
                        autoFocus
                      />
                      <input
                        type="password"
                        value={forgotPassword}
                        onChange={e => setForgotPassword(e.target.value)}
                        placeholder="New password (8+ characters)"
                        className={signupInputClass}
                      />
                      <input
                        type="password"
                        value={forgotConfirm}
                        onChange={e => setForgotConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className={signupInputClass}
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
                className="rounded-2xl px-8 py-8 flex flex-col"
                style={{ backgroundColor: 'transparent' }}
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
          onSubmit={handleSignupContinue}
          className="flex flex-1 flex-col min-h-0 w-full h-full overflow-hidden"
          style={{ backgroundColor: 'transparent' }}
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
                  style={{ width: `${(step / signupScreens.length) * 100}%` }}
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

        {signupScreen === 'type' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('personal')}
              className={`rounded-xl border-[3px] border-white px-3 py-6 text-sm font-semibold ${
                accountType === 'personal' ? 'bg-white text-black' : 'bg-transparent text-white'
              }`}
            >
              Creator
            </button>
            <button
              type="button"
              onClick={() => setAccountType('business')}
              className={`rounded-xl border-[3px] border-white px-3 py-6 text-sm font-semibold ${
                accountType === 'business' ? 'bg-white text-black' : 'bg-transparent text-white'
              }`}
            >
              Business
            </button>
          </div>
        )}

        {signupScreen === 'email' && (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={signupInputClass}
              placeholder="Email"
              autoComplete="email"
              autoFocus
            />
            {signupFieldErrors.email && <p className="text-xs text-red-400 px-1">{signupFieldErrors.email}</p>}
            <p className="text-center text-[11px] leading-4 text-gray-500">
              By continuing, you agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#7A8AF0] hover:underline">Terms</Link>
              {' '}and{' '}
              <Link to="/terms#community-guidelines" target="_blank" rel="noopener noreferrer" className="text-[#7A8AF0] hover:underline">Community Guidelines</Link>.
              You must be 13 or older.
            </p>
          </div>
        )}

        {signupScreen === 'password' && (
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  const next = e.target.value;
                  setPassword(next);
                  if (signupPasswordIssue(next) == null) {
                    setSignupFieldErrors({});
                    setSignupError('');
                  }
                }}
                className={`${signupInputClass} pr-10`}
                placeholder="Password, 8+ characters"
                autoComplete="new-password"
                autoFocus
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
            <p className={`mt-3 text-xs ${signupPasswordIssue(password) == null ? 'text-white' : 'text-gray-500'}`}>
              Use 8 or more characters, with a letter and a number.
            </p>
          </div>
        )}

        {signupScreen === 'name' && (
          <div className="space-y-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className={signupInputClass}
              placeholder={isBusinessAccount ? 'Business name' : 'Full name'}
              autoComplete="name"
              autoFocus
            />
            {signupFieldErrors.name && <p className="text-xs text-red-400 px-1">{signupFieldErrors.name}</p>}
            {isBusinessAccount && businessUsername.length >= 3 ? (
              <p className="text-xs text-gray-400 px-1">Your handle will be <span className="text-white">{handlePreview}</span></p>
            ) : null}
          </div>
        )}

        {signupScreen === 'birthday' && (
          <div>
            <p className="mb-2 text-xs text-gray-500">
              {isBusinessAccount ? 'Account owner’s date of birth. You must be 13 or older.' : 'You must be 13 or older.'}
            </p>
            <div className="grid grid-cols-12 gap-2">
              <div className="relative col-span-5">
                <select
                  value={birthMonth}
                  onChange={e => setBirthMonth(e.target.value)}
                  className={`${signupInputClass} appearance-none pr-8`}
                >
                  <option value="">Month</option>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
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
            {signupFieldErrors.birthdate && <p className="mt-1.5 px-1 text-xs text-red-400">{signupFieldErrors.birthdate}</p>}
          </div>
        )}

        {signupScreen === 'place' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">This sets your news feed.</p>
            {!showManualPlace ? (
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
                placeholder={isBusinessAccount ? 'Town or area' : 'Town or area'}
                inputClassName={signupPlaceInputClass}
              />
            ) : (
              <div className="space-y-2">
                <input value={local} onChange={e => setLocal(e.target.value)} className={signupInputClass} placeholder="Town or neighbourhood" />
                <input value={regional} onChange={e => setRegional(e.target.value)} className={signupInputClass} placeholder="County or region" />
                <input value={national} onChange={e => setNational(e.target.value)} className={signupInputClass} placeholder="Country" />
              </div>
            )}
            {!homeLocationComplete && !showManualPlace && homeLocationQuery.trim().length >= 2 && (
              <p className="text-xs text-amber-300/90">Select a suggestion from the list.</p>
            )}
            {signupFieldErrors.homeLocation && <p className="text-xs text-red-400">{signupFieldErrors.homeLocation}</p>}
            {homeLocationComplete && (
              <div className="text-sm text-white">
                <p>Your feed follows {signupFeedTierRows(local, regional, national).map((row) => row.value).join(', ') || [local, regional, national].filter(Boolean).join(', ')}.</p>
                <button type="button" onClick={clearHomeLocation} className="mt-1 text-xs text-[#7A8AF0] hover:underline">Change</button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowManualPlace((open) => !open)}
              className="text-xs text-[#7A8AF0] hover:underline"
            >
              {showManualPlace ? 'Search instead' : 'Can’t find it?'}
            </button>
          </div>
        )}

        {signupScreen === 'username' && (
          <div className="space-y-2">
            <input
              value={username}
              onChange={e => setUsername(sanitizeSignupUsernameInput(e.target.value))}
              className={signupInputClass}
              placeholder="One word, e.g. John or JohnS"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
            />
            {signupFieldErrors.username && <p className="text-xs text-red-400 px-1">{signupFieldErrors.username}</p>}
            {sanitizeSignupUsernameInput(username).length >= 3 && regional ? (
              <p className="text-xs text-gray-400 px-1">Your handle will be <span className="text-white">{handlePreview}</span></p>
            ) : null}
          </div>
        )}

        {signupScreen === 'photo' && (
          <>
            <p className="text-center text-sm text-gray-400">
              <span className="font-medium text-white">@{handlePreview}</span>
              {previewCountryFlag ? (
                <span className="ml-1.5 inline-flex align-middle">
                  <Flag value={previewCountryFlag} national={national} size={16} />
                </span>
              ) : null}
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
                  <button type="button" onClick={() => setProfilePicture(null)} className="rounded-lg px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                    Remove
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-gray-500">Optional. Initials are used if you skip.</p>
            </div>
          </>
        )}

            </div>
          </div>

          <div className="flex-shrink-0 border-t border-white/10 bg-black px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-10">
            <div className="mx-auto w-full max-w-[400px] space-y-2">
              <div className="flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    disabled={signupSubmitting}
                    onClick={() => updateStep(step - 1)}
                    className="flex-1 rounded-lg border border-white/25 bg-transparent px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-45"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={signupSubmitting}
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/50"
                >
                  {signupSubmitting ? 'Please wait…' : signupScreen === 'photo' ? 'Create account' : 'Next'}
                </button>
              </div>
              {signupScreen === 'type' && (
                <p className="text-center text-xs text-gray-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setSearchParams({ mode: 'login' });
                    }}
                    className="font-medium text-[#7A8AF0] hover:underline"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </div>

      </form>
        )}
      </div>
    </div>
  );
}
