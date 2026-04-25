import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiX, FiEye, FiEyeOff, FiFileText, FiShield, FiCheck } from 'react-icons/fi';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { loginUser } from '../api/client';

const LOCAL_REGISTRATIONS_KEY = 'gazetteer_local_registrations';

type PageMode = 'signup' | 'login';

function getLocalRegistrations(): Record<string, { password: string; userData: any }> {
  try {
    const s = localStorage.getItem(LOCAL_REGISTRATIONS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function saveLocalRegistration(email: string, password: string, userData: any) {
  const reg = getLocalRegistrations();
  reg[email.toLowerCase().trim()] = { password, userData };
  localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(reg));
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
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  
  // Get step from URL parameter, default to 1 - use URL as source of truth
  const stepFromUrl = parseInt(searchParams.get('step') || '1', 10);
  const step = (stepFromUrl >= 1 && stepFromUrl <= 2) ? stepFromUrl : 1;
  
  // Helper function to update step (updates both state and URL)
  const updateStep = React.useCallback((newStep: number) => {
    if (newStep >= 1 && newStep <= 2) {
      setSignupError('');
      setSearchParams({ step: newStep.toString() });
    }
  }, [setSearchParams]);

  // Step 1: Location data
  const [name, setName] = React.useState('');
  const [local, setLocal] = React.useState('');
  const [regional, setRegional] = React.useState('');
  const [national, setNational] = React.useState('');
  const [countryFlag, setCountryFlag] = React.useState('');

  // Dynamic location options
  const [regionalOptions, setRegionalOptions] = React.useState<string[]>([]);
  const [localOptions, setLocalOptions] = React.useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = React.useState(false);
  const [loadingCities, setLoadingCities] = React.useState(false);

  // Step 1: Account details (email, password, birthday)
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [birthMonth, setBirthMonth] = React.useState('');
  const [birthDay, setBirthDay] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [preferredLocationsInput, setPreferredLocationsInput] = React.useState('');
  const [accountType, setAccountType] = React.useState<'personal' | 'business' | null>(null);

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

  const nationalOptions = [
    // Europe
    'Ireland', 'Northern Ireland', 'UK', 'Germany', 'France', 'Spain', 'Italy',
    'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Poland', 'Portugal',
    'Greece', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Czech Republic',
    'Romania', 'Hungary', 'Bulgaria', 'Croatia', 'Serbia', 'Slovakia', 'Slovenia',
    'Lithuania', 'Latvia', 'Estonia', 'Luxembourg', 'Malta', 'Cyprus', 'Iceland',
    'Ukraine', 'Belarus', 'Moldova', 'Albania', 'North Macedonia', 'Bosnia and Herzegovina',
    'Montenegro', 'Kosovo', 'Monaco', 'Liechtenstein', 'Andorra', 'San Marino', 'Vatican City',
    'Turkey',
    
    // Americas
    'USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
    'Venezuela', 'Ecuador', 'Guatemala', 'Cuba', 'Haiti', 'Dominican Republic',
    'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Uruguay',
    'Paraguay', 'Bolivia', 'Jamaica', 'Trinidad and Tobago', 'Bahamas', 'Barbados',
    'Belize', 'Guyana', 'Suriname', 'French Guiana', 'Saint Lucia', 'Antigua and Barbuda',
    'Saint Vincent and the Grenadines', 'Grenada', 'Saint Kitts and Nevis', 'Dominica',
    'Aruba', 'Curaçao', 'Bonaire', 'Sint Maarten', 'Sint Eustatius', 'Saba',
    'Bermuda', 'Cayman Islands', 'British Virgin Islands', 'US Virgin Islands',
    'Anguilla', 'Montserrat', 'Turks and Caicos Islands', 'Greenland', 'Saint Pierre and Miquelon',
    
    // Asia
    'China', 'India', 'Japan', 'Russia', 'Indonesia', 'Pakistan', 'Bangladesh',
    'Philippines', 'Vietnam', 'Thailand', 'Myanmar', 'South Korea', 'North Korea',
    'Malaysia', 'Afghanistan', 'Iraq', 'Saudi Arabia', 'Uzbekistan', 'Yemen',
    'Nepal', 'Sri Lanka', 'Kazakhstan', 'Cambodia', 'Jordan', 'Azerbaijan',
    'United Arab Emirates', 'Tajikistan', 'Israel', 'Laos', 'Lebanon', 'Kyrgyzstan',
    'Turkmenistan', 'Singapore', 'Oman', 'Palestine', 'Kuwait', 'Georgia', 'Mongolia',
    'Armenia', 'Qatar', 'Bahrain', 'Timor-Leste', 'Bhutan', 'Maldives', 'Brunei',
    'Iran', 'Syria',
    
    // Africa
    'Nigeria', 'Ethiopia', 'Egypt', 'South Africa', 'Kenya', 'Uganda', 'Tanzania',
    'Algeria', 'Sudan', 'Morocco', 'Angola', 'Mozambique', 'Ghana', 'Madagascar',
    'Cameroon', 'Ivory Coast', 'Niger', 'Burkina Faso', 'Mali', 'Malawi', 'Zambia',
    'Senegal', 'Chad', 'Somalia', 'Zimbabwe', 'Guinea', 'Rwanda', 'Benin', 'Tunisia',
    'Burundi', 'South Sudan', 'Togo', 'Sierra Leone', 'Libya', 'Eritrea', 'Central African Republic',
    'Liberia', 'Mauritania', 'Namibia', 'Botswana', 'Gambia', 'Gabon', 'Lesotho',
    'Guinea-Bissau', 'Equatorial Guinea', 'Mauritius', 'Eswatini', 'Djibouti', 'Comoros',
    'Cape Verde', 'São Tomé and Príncipe', 'Seychelles',
    
    // Oceania
    'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
    'Vanuatu', 'New Caledonia', 'French Polynesia', 'Samoa', 'Guam', 'Kiribati',
    'Micronesia', 'Tonga', 'Marshall Islands', 'Palau', 'American Samoa', 'Northern Mariana Islands',
    'Cook Islands', 'Tuvalu', 'Wallis and Futuna', 'Nauru', 'Niue', 'Tokelau', 'Pitcairn Islands'
  ];

  // Fetch regions when national selection changes
  React.useEffect(() => {
    if (national) {
      setLoadingRegions(true);
      setRegionalOptions([]);
      setRegional(''); // Reset regional selection
      setLocal(''); // Reset local selection
      setLocalOptions([]);
      
      fetchRegionsForCountry(national)
        .then(regions => {
          setRegionalOptions(regions.map(r => r.name));
          setLoadingRegions(false);
        })
        .catch(error => {
          console.error('Error loading regions:', error);
          setLoadingRegions(false);
        });
    } else {
      setRegionalOptions([]);
      setLocalOptions([]);
    }
  }, [national]);

  // Fetch cities when regional selection changes
  React.useEffect(() => {
    if (regional && national) {
      setLoadingCities(true);
      setLocalOptions([]);
      setLocal(''); // Reset local selection
      
      console.log(`Fetching local areas for region: ${regional}, country: ${national}`);
      fetchCitiesForRegion(regional, national)
        .then(localAreas => {
          console.log(`Received ${localAreas.length} local areas for ${regional}, ${national}:`, localAreas);
          setLocalOptions(localAreas.map(c => c.name));
          setLoadingCities(false);
        })
        .catch(error => {
          console.error('Error loading local areas:', error);
          setLoadingCities(false);
        });
    } else {
      setLocalOptions([]);
    }
  }, [regional, national]);

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
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
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
    if (!name || !local || !regional || !national) {
      if (!name) nextErrors.name = 'Full name is required.';
      if (!national) nextErrors.national = 'Select your national area.';
      if (!regional) nextErrors.regional = 'Select your regional area.';
      if (!local) nextErrors.local = 'Select your local area.';
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
    const consentTimestamp = new Date().toISOString();
    const preferredLocations = preferredLocationsInput
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12);

    const userData = {
      name: name.trim(),
      email: email.trim(),
      password: password,
      age: age ?? undefined,
      local: local,
      regional: regional,
      national: national,
      handle: `${name.trim().split(/\s+/)[0] || name.trim()}@${regional}`,
      countryFlag: countryFlag.trim(),
      avatarUrl: undefined as string | undefined,
      placesTraveled: preferredLocations.length > 0 ? preferredLocations : undefined,
      accountType: accountType ?? 'personal',
      termsAcceptedAt: consentTimestamp,
      guidelinesAcceptedAt: consentTimestamp,
    };

    try {
      const userDataForStorage = { ...userData, avatarUrl: undefined };
      saveLocalRegistration(email.trim(), password, userDataForStorage);
      login(userData);
      nav('/feed', { replace: true, state: { fromSignup: true } });
    } catch (err: any) {
      console.error('Sign up error:', err);
      setSignupError(err?.message || 'Something went wrong. Try again.');
    }
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
        nav('/feed', { replace: true });
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
        nav('/feed', { replace: true });
        return;
      }
      // Also try current user in localStorage (e.g. signed up before we stored localRegistrations)
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const u = JSON.parse(savedUser);
          if (u?.email?.toLowerCase() === key && u?.password === loginPassword) {
            login(u);
            nav('/feed', { replace: true });
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
                  <button type="button" onClick={() => setMode('signup')} className="text-[#7A8AF0] hover:underline font-medium">
                    Sign up
                  </button>
                </p>
              </div>
              </form>
            )}
          </div>
        ) : (
        <div
          className="max-w-md mx-auto rounded-2xl p-[1.5px] shadow-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #f6e27a 0%, #d4af37 24%, #f4f4f4 48%, #bfc5cc 72%, #ffe8a3 100%)' }}
        >
        <form
          onSubmit={step === 1 ? handleAccountSubmit : handleLocationSubmit}
          className="rounded-2xl bg-black flex flex-col min-h-0"
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
                {step === 1 ? 'Step 1: Account security' : 'Step 2: Profile and location'}
              </p>
              
              {/* Step Indicators - two steps only */}
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
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 pb-8 space-y-2 sm:space-y-3">
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

            {/* National Area */}
            <div className="relative">
              <select
                value={national}
                onChange={e => setNational(e.target.value)}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-white appearance-none"
                required
              >
                <option value="">National Area</option>
                {nationalOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {signupFieldErrors.national && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.national}</p>}
            </div>

            {/* Regional Area */}
            <div className="relative">
              <select
                value={regional}
                onChange={e => setRegional(e.target.value)}
                disabled={!national || loadingRegions}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                required
              >
                <option value="">
                  {loadingRegions ? 'Loading regions...' : national ? 'Regional Area' : 'Select national area first'}
                </option>
                {regionalOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {signupFieldErrors.regional && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.regional}</p>}
            </div>

            {/* Local Area */}
            <div className="relative">
              <select
                value={local}
                onChange={e => setLocal(e.target.value)}
                disabled={!regional || loadingCities}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                required
              >
                <option value="">
                  {loadingCities 
                    ? 'Loading local areas...' 
                    : !regional 
                      ? 'Select regional area first'
                      : localOptions.length === 0
                        ? 'No local areas found'
                        : 'Local Area'}
                </option>
                {localOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {!loadingCities && regional && localOptions.length === 0 && (
                <p className="text-xs text-red-500 mt-1.5 px-1">
                  No local areas found for {regional}. Check browser console for details or add Google Maps API key.
                </p>
              )}
              {signupFieldErrors.local && <p className="text-xs text-red-400 mt-1.5 px-1">{signupFieldErrors.local}</p>}
            </div>

            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-gray-400">Your handle preview</p>
              <p className="text-sm text-white font-medium">
                @{(name.trim().split(/\s+/)[0] || 'yourname')}
                {regional ? `@${regional}` : '@yourregion'}
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-gray-400 mb-1">Preferred locations for suggestions (optional)</p>
              <textarea
                value={preferredLocationsInput}
                onChange={e => setPreferredLocationsInput(e.target.value)}
                className="w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white"
                placeholder="Dublin, Barcelona, New York"
                rows={2}
              />
              <p className="mt-1 text-[11px] text-gray-500">Comma separated. You can edit this later in profile settings.</p>
            </div>
          </>
        )}

            {/* Footer - inside scroll area so T&C is reachable on mobile */}
            <div className="pt-6 mt-4 border-t border-gray-700 space-y-3">
              <button
                type="submit"
                className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl transition-colors text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 1 ? 'Continue' : 'Create account'}
              </button>
              
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => updateStep(step - 1)}
                  className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold border border-white"
                >
                  Back
                </button>
              )}

              <p className="text-xs text-center text-gray-400 mt-4">
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-[#7A8AF0] hover:underline font-medium">
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
        </div>
      </form>
      </div>
        )}
      </div>
    </div>
  );
}
