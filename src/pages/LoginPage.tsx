import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe } from 'react-icons/fi';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = React.useState(1); // 1 = location, 2 = account details

  // Step 1: Location data
  const [name, setName] = React.useState('');
  const [local, setLocal] = React.useState('');
  const [regional, setRegional] = React.useState('');
  const [national, setNational] = React.useState('');

  // Step 2: Account details
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [age, setAge] = React.useState('');
  const [interests, setInterests] = React.useState<string[]>([]);

  const localOptions = [
    'Ballymun', 'Finglas', 'Cabra', 'Phibsborough', 'Drumcondra',
    'Glasnevin', 'Coolock', 'Raheny', 'Clontarf', 'Howth'
  ];

  const regionalOptions = [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford',
    'Kilkenny', 'Sligo', 'Donegal', 'Kerry', 'Mayo'
  ];

  const nationalOptions = [
    'Ireland', 'Northern Ireland', 'UK', 'USA', 'Canada',
    'Australia', 'New Zealand', 'Germany', 'France', 'Spain'
  ];

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
    setStep(2);
  }

  function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !confirmPassword || !age) {
      alert('Please fill in all account fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (parseInt(age) < 13) {
      alert('You must be at least 13 years old');
      return;
    }

    // Create user with complete data
    const userData = {
      name: name.trim(),
      email: email.trim(),
      password: password, // In real app, this would be hashed
      age: parseInt(age),
      interests: interests,
      local: local,
      regional: regional,
      national: national,
      handle: `${name.trim()}@${local}` // Generate handle like "John@Ballymun"
    };

    login(userData);
    nav('/profile', { replace: true });
  }

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  }

  return (
    <div className="mx-auto max-w-md min-h-screen flex items-center justify-center p-6">
      <form onSubmit={step === 1 ? handleLocationSubmit : handleAccountSubmit} className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Join Clips</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {step === 1 ? 'Connect with your local community' : 'Complete your profile'}
          </p>
          <div className="flex justify-center mt-3">
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step === 1 ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step === 2 ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <>
            {/* Step 1: Location Selection */}
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiUser className="inline w-4 h-4 mr-1" />
                Your Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Local Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiMapPin className="inline w-4 h-4 mr-1" />
                Local Area
              </label>
              <select
                value={local}
                onChange={e => setLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              >
                <option value="">Select your local area</option>
                {localOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Regional Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiMapPin className="inline w-4 h-4 mr-1" />
                Regional Area
              </label>
              <select
                value={regional}
                onChange={e => setRegional(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              >
                <option value="">Select your regional area</option>
                {regionalOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* National Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiGlobe className="inline w-4 h-4 mr-1" />
                National Area
              </label>
              <select
                value={national}
                onChange={e => setNational(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              >
                <option value="">Select your national area</option>
                {nationalOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Account Details */}
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Create a password"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Confirm your password"
                required
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Age
              </label>
              <input
                type="number"
                min="13"
                max="120"
                value={age}
                onChange={e => setAge(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Your age"
                required
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interests (Select up to 5)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {interestOptions.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`p-2 rounded-lg text-sm border transition-colors ${interests.includes(interest)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    disabled={!interests.includes(interest) && interests.length >= 5}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex space-x-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-500 text-white font-medium hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            className="flex-1 px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            {step === 1 ? 'Continue' : 'Join Clips'}
          </button>
        </div>

        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          By joining, you agree to connect with your local community
        </div>

        {/* Temporary clear button for debugging */}
        <button
          type="button"
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="w-full px-3 py-2 rounded bg-gray-500 text-white text-sm hover:bg-gray-600"
        >
          Clear Data & Refresh (Debug)
        </button>
      </form>
    </div>
  );
}
