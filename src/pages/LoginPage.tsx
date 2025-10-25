import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiUser, FiGlobe, FiCamera, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = React.useState(1); // 1 = location, 2 = account details, 3 = profile picture

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

  // Step 3: Profile picture
  const [profilePicture, setProfilePicture] = React.useState<string | null>(null);

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
    setStep(3);
  }

  function handleProfilePictureSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Create user with complete data including profile picture
    const userData = {
      name: name.trim(),
      email: email.trim(),
      password: password, // In real app, this would be hashed
      age: parseInt(age),
      interests: interests,
      local: local,
      regional: regional,
      national: national,
      handle: `${name.trim()}@${local}`, // Generate handle like "John@Ballymun"
      avatarUrl: profilePicture // Include profile picture
    };

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

  return (
    <div className="mx-auto max-w-md min-h-screen flex items-center justify-center p-6">
      <form onSubmit={step === 1 ? handleLocationSubmit : step === 2 ? handleAccountSubmit : handleProfilePictureSubmit} className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Join Clips</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {step === 1 ? 'Connect with your local community' : step === 2 ? 'Complete your profile' : 'Add a profile picture'}
          </p>
          <div className="flex justify-center mt-3">
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step === 1 ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step === 2 ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step === 3 ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>

        {step === 1 && (
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
        )}

        {step === 2 && (
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

        {step === 3 && (
          <>
            {/* Step 3: Profile Picture */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Add a Profile Picture
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Choose a photo that represents you, or skip to use your initials
              </p>

              {/* Current Avatar Preview */}
              <div className="flex justify-center mb-6">
                <Avatar
                  src={profilePicture || undefined}
                  name={name || 'User'}
                  size="xl"
                  className="border-4 border-gray-200 dark:border-gray-700"
                />
              </div>

              {/* Upload Button */}
              <div className="space-y-4">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureSelect}
                    className="hidden"
                  />
                  <div className="w-full px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors cursor-pointer text-center font-medium">
                    <FiCamera className="inline w-4 h-4 mr-2" />
                    Choose Photo
                  </div>
                </label>

                {profilePicture && (
                  <button
                    type="button"
                    onClick={removeProfilePicture}
                    className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-center font-medium"
                  >
                    <FiX className="inline w-4 h-4 mr-2" />
                    Remove Photo
                  </button>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Your initials will be used if no photo is selected
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex space-x-3">
          {(step === 2 || step === 3) && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-500 text-white font-medium hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            className="flex-1 px-4 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            {step === 1 ? 'Continue' : step === 2 ? 'Continue' : 'Join Clips'}
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
