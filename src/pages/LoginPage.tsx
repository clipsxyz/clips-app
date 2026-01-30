import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiCamera, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = React.useState<PageMode>('signup');
  const [loginError, setLoginError] = React.useState('');
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  
  // Get step from URL parameter, default to 1 - use URL as source of truth
  const stepFromUrl = parseInt(searchParams.get('step') || '1', 10);
  const step = (stepFromUrl >= 1 && stepFromUrl <= 3) ? stepFromUrl : 1;
  
  // Helper function to update step (updates both state and URL)
  const updateStep = React.useCallback((newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
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

  // Step 2: Account details
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [age, setAge] = React.useState('');
  const [interests, setInterests] = React.useState<string[]>([]);

  // Step 3: Profile picture
  const [profilePicture, setProfilePicture] = React.useState<string | null>(null);

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

  const interestOptions = [
    'Food & Dining', 'Sports', 'Music', 'Art & Culture', 'Technology',
    'Travel', 'Fashion', 'Photography', 'Fitness', 'Gaming',
    'Books', 'Movies', 'Nature', 'Cooking', 'Dancing'
  ];

  function handleLocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !local || !regional || !national) {
      alert('Please fill in all location fields');
      return;
    }
    updateStep(2);
  }

  function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      alert('Please fill in all required account fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // Age is optional, but if provided, must be at least 13
    if (age && parseInt(age) < 13) {
      alert('You must be at least 13 years old');
      return;
    }
    updateStep(3);
  }

  function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Create user with complete data including profile picture
    const userData = {
      name: name.trim(),
      email: email.trim(),
      password: password, // In real app, this would be hashed
      age: age ? parseInt(age) : undefined, // Age is optional
      interests: interests,
      local: local,
      regional: regional,
      national: national,
      handle: `${name.trim()}@${regional}`, // Generate handle like "Barry@Dublin"
      countryFlag: countryFlag.trim(),
      avatarUrl: profilePicture // Include profile picture
    };

    saveLocalRegistration(email.trim(), password, userData);
    login(userData);
    nav('/profile', { replace: true });
  }

  function handleProfilePictureSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicture(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function removeProfilePicture() {
    setProfilePicture(null);
  }

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
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
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#000000' }}>
      <div className="w-full max-w-md">
        {/* Sign up / Log in toggle */}
        <div className="flex justify-center gap-6 mb-4">
          <button
            type="button"
            onClick={() => { setMode('signup'); setLoginError(''); }}
            className={`text-sm font-medium transition-colors ${mode === 'signup' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-300'}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setLoginError(''); }}
            className={`text-sm font-medium transition-colors ${mode === 'login' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-300'}`}
          >
            Log in
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="border border-gray-700 rounded-lg shadow-sm flex flex-col px-10 py-10" style={{ backgroundColor: '#000000' }}>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-light mb-2 tracking-tight text-white">Gazetteer</h1>
              <p className="text-sm text-gray-400">Log in to your account</p>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                autoComplete="email"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                autoComplete="current-password"
              />
              {loginError && <p className="text-xs text-red-500">{loginError}</p>}
            </div>
            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Logging in…' : 'Log in'}
              </button>
              <p className="text-xs text-center text-gray-400">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-blue-500 hover:underline font-medium">
                  Sign up
                </button>
              </p>
            </div>
          </form>
        ) : (
        <form onSubmit={step === 1 ? handleLocationSubmit : step === 2 ? handleAccountSubmit : handleProfilePictureSubmit} className="border border-gray-700 rounded-lg shadow-sm flex flex-col" style={{ minHeight: '600px', backgroundColor: '#000000' }}>
          {/* Header */}
          <div className="flex-shrink-0 px-10 pt-10 pb-6">
            <div className="text-center">
              <h1 
                className="text-3xl font-light mb-2 tracking-tight relative" 
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
              <p className="text-sm text-gray-400 mb-6 font-normal">
                {step === 1 ? 'GPS-focused news feeds powered by location' : step === 2 ? 'Complete your profile' : 'Add a profile picture'}
              </p>
              
              {/* Step Indicators - Instagram style */}
              <div className="flex justify-center items-center space-x-2 mb-6">
                <div className={`h-1 rounded-full transition-all ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: step >= 1 ? '80px' : '40px' }}></div>
                <div className={`h-1 rounded-full transition-all ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: step >= 2 ? '80px' : '40px' }}></div>
                <div className={`h-1 rounded-full transition-all ${step >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: step >= 3 ? '80px' : '40px' }}></div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-10 pb-4 space-y-3">

        {step === 1 && (
          <>
            {/* Step 1: Location Selection - Instagram Style */}
            {/* Name Input */}
            <div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                placeholder="Full Name"
                required
              />
            </div>

            {/* National Area */}
            <div className="relative">
              <select
                value={national}
                onChange={e => setNational(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 appearance-none"
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
            </div>

            {/* Regional Area */}
            <div className="relative">
              <select
                value={regional}
                onChange={e => setRegional(e.target.value)}
                disabled={!national || loadingRegions}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
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
            </div>

            {/* Local Area */}
            <div className="relative">
              <select
                value={local}
                onChange={e => setLocal(e.target.value)}
                disabled={!regional || loadingCities}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
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
            </div>

            {/* Country Flag (Emoji) */}
            <div>
              <input
                value={countryFlag}
                onChange={e => setCountryFlag(e.target.value)}
                maxLength={8}
                placeholder="Country Flag (emoji)"
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Step 2: Account Details - Instagram Style */}
            {/* Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                placeholder="Email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                placeholder="Password"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                placeholder="Confirm Password"
                required
              />
            </div>

            {/* Age */}
            <div>
              <input
                type="number"
                min="13"
                max="120"
                value={age}
                onChange={e => setAge(e.target.value)}
                className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500"
                placeholder="Age (optional)"
              />
            </div>

            {/* Interests */}
            <div className="pt-2">
              <p className="text-xs text-gray-400 mb-3 px-1">Select up to 5 interests</p>
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    const selectedInterest = e.target.value;
                    if (selectedInterest && !interests.includes(selectedInterest) && interests.length < 5) {
                      toggleInterest(selectedInterest);
                    }
                    e.target.value = ''; // Reset dropdown
                  }}
                  className="w-full rounded-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 appearance-none"
                  disabled={interests.length >= 5}
                >
                  <option value="">Select an interest</option>
                  {interestOptions
                    .filter(interest => !interests.includes(interest))
                    .map(interest => (
                      <option key={interest} value={interest}>{interest}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {/* Selected Interests as Chips */}
              {interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {interests.map(interest => (
                    <div
                      key={interest}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-sm text-xs"
                    >
                      <span>{interest}</span>
                      <button
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className="hover:bg-blue-600 rounded-full p-0.5 transition-colors"
                        aria-label={`Remove ${interest}`}
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {interests.length >= 5 && (
                <p className="text-xs text-gray-400 mt-2 px-1">Maximum 5 interests selected</p>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {/* Step 3: Profile Picture - Instagram Style */}
            <div className="text-center py-4">
              {/* Current Avatar Preview */}
              <div className="flex justify-center mb-6">
                <Avatar
                  src={profilePicture || undefined}
                  name={name || 'User'}
                  size="xl"
                  className="border-2 border-gray-300 dark:border-gray-600"
                />
              </div>

              {/* Upload Button */}
              <div className="space-y-3">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureSelect}
                    className="hidden"
                  />
                  <div className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors cursor-pointer text-center text-sm font-semibold">
                    <FiCamera className="inline w-4 h-4 mr-2" />
                    Choose Photo
                  </div>
                </label>

                {profilePicture && (
                  <button
                    type="button"
                    onClick={removeProfilePicture}
                    className="w-full px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-center text-sm font-semibold"
                  >
                    <FiX className="inline w-4 h-4 mr-2" />
                    Remove Photo
                  </button>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Your initials will be used if no photo is selected
                </p>
              </div>
            </div>
          </>
        )}
        </div>

        {/* Footer - Instagram Style */}
        <div className="flex-shrink-0 px-10 pb-10 pt-6 border-t border-gray-700">
          <div className="space-y-3">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 1 ? 'Next' : step === 2 ? 'Next' : 'Sign Up'}
            </button>
            
            {(step === 2 || step === 3) && (
              <button
                type="button"
                onClick={() => updateStep(step - 1)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-semibold"
              >
                Back
              </button>
            )}

            <p className="text-xs text-center text-gray-400 mt-4">
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-blue-500 hover:underline font-medium">
                Log in
              </button>
            </p>
            <p className="text-xs text-center text-gray-500 mt-1">
              {step === 1 
                ? 'By signing up, you agree to the terms and conditions and community guidelines'
                : 'By signing up, you agree to connect with your local community'
              }
            </p>
          </div>
        </div>
      </form>
        )}
      </div>
    </div>
  );
}
