import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { FiMapPin, FiGlobe } from 'react-icons/fi';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect logged-in users to feed - they should never see landing page
  // Temporarily disabled for testing - uncomment to re-enable
  // useEffect(() => {
  //   if (user) {
  //     navigate('/feed', { replace: true });
  //   }
  // }, [user, navigate]);

  const handleCreateAccount = () => {
    navigate('/login');
  };

  return (
    <div className="h-screen bg-[#1a1f2e] text-white overflow-hidden flex flex-col">
      {/* Map Background covering header and pins section */}
      <div className="relative flex-shrink-0">
        {/* World Map Background - extends behind title and pins */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `url("https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'grayscale(80%) brightness(0.5) contrast(1.2)'
          }}
        />
        {/* Grid overlay for map effect */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />
        
        {/* Header - sits on top of map */}
        <div className="relative pt-3 pb-1 px-4 text-center z-10">
          <h1 className="text-xl font-bold text-white">No algorithms, Just places</h1>
        </div>

        {/* Pins with profile pictures - smaller */}
        <div className="relative h-24 mx-3 mb-2 z-10">
          {/* Green pin - left - person covering mouth */}
          <div className="absolute left-3 top-4">
            <div className="relative">
              <FiMapPin className="text-green-500 text-lg drop-shadow-lg" />
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-md overflow-hidden border border-green-500">
                <img 
                  src="https://api.dicebear.com/7.x/personas/svg?seed=hand&backgroundColor=fbbf24&radius=8" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.parentElement;
                    if (fallback) {
                      fallback.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center"><div class="w-6 h-6 bg-gray-700 rounded-full mt-1"></div></div>';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Yellow-orange pins cluster - left center */}
          <div className="absolute left-8 top-8">
            <div className="relative">
              <FiMapPin className="text-yellow-500 text-sm drop-shadow-lg" />
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-md overflow-hidden border border-yellow-500">
                <div className="w-full h-full bg-yellow-300 flex items-center justify-center text-[10px]">
                  😛
                </div>
              </div>
            </div>
          </div>
          <div className="absolute left-10 top-12">
            <div className="relative">
              <FiMapPin className="text-orange-500 text-xs drop-shadow-lg" />
              <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-md overflow-hidden border border-orange-500">
                <img 
                  src="https://api.dicebear.com/7.x/personas/svg?seed=two&backgroundColor=fb923c,ec4899&radius=6" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.parentElement;
                    if (fallback) {
                      fallback.innerHTML = '<div class="w-full h-full flex"><div class="w-1/2 bg-orange-400"></div><div class="w-1/2 bg-pink-400"></div></div>';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Orange pin - center - smiling person with curly red hair */}
          <div className="absolute left-1/2 top-6 transform -translate-x-1/2">
            <div className="relative">
              <FiMapPin className="text-orange-500 text-lg drop-shadow-lg" />
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-md overflow-hidden border border-orange-500">
                <img 
                  src="https://api.dicebear.com/7.x/personas/svg?seed=smile&hair=curly&hairColor=dc2626&backgroundColor=fb923c&radius=8" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.parentElement;
                    if (fallback) {
                      fallback.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-red-300 to-red-500 flex items-center justify-center"><div class="w-6 h-6 bg-white rounded-full"></div></div>';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Green pin - right center - person with cap */}
          <div className="absolute right-10 top-8">
            <div className="relative">
              <FiMapPin className="text-green-500 text-sm drop-shadow-lg" />
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-md overflow-hidden border border-green-500">
                <img 
                  src="https://api.dicebear.com/7.x/personas/svg?seed=cap&accessories=cap&backgroundColor=3b82f6&radius=6" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.parentElement;
                    if (fallback) {
                      fallback.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-300 to-blue-500 flex flex-col"><div class="h-3 bg-gray-800"></div><div class="flex-1 bg-amber-200"></div></div>';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Gradient pin - far right - foot on skateboard */}
          <div className="absolute right-4 top-12">
            <div className="relative">
              <FiMapPin className="text-pink-500 text-sm drop-shadow-lg" />
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-md overflow-hidden border border-pink-500">
                <div className="w-full h-full bg-gradient-to-br from-yellow-200 via-pink-300 to-purple-300 flex items-end justify-center pb-0.5">
                  <div className="w-3 h-1 bg-gray-700 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Introduction Section */}
      <div className="px-4 mb-2 flex-1 flex flex-col justify-center min-h-0">
        <h2 className="text-xl font-bold mb-1 text-center">Introducing Gazetteer</h2>
        <p className="text-xs text-gray-300 mb-3 leading-tight">
          Discover real-time stories from anywhere in the world. Explore news, posts, and conversations by place—not algorithms.
        </p>

        {/* Create Account Button */}
        <button
          onClick={handleCreateAccount}
          className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg font-semibold text-sm hover:bg-blue-600 transition-colors mb-3"
        >
          Create an Account
        </button>

        {/* How World-Based Feeds Work Section - Compact */}
        <div className="px-0">
          <h2 className="text-sm font-bold mb-2">How World-Based Feeds Work</h2>

          {/* Steps - very compact */}
          <div className="space-y-1.5">
            {/* Step 1 */}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold mb-0.5">Explore the App</h3>
                  <p className="text-[10px] text-gray-300 leading-tight">
                    Join Gazetteer to follow locations, cities, events, or breaking news zones.
                  </p>
                  <div className="bg-gray-700 rounded mt-1 p-1.5 h-10 flex items-center justify-center">
                    <div className="flex gap-1 justify-center">
                      <FiGlobe className="text-blue-400 text-sm" />
                      <FiMapPin className="text-green-500 text-xs" />
                      <FiMapPin className="text-yellow-500 text-xs" />
                      <FiMapPin className="text-red-500 text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold mb-0.5">Tap a Location</h3>
                  <p className="text-[10px] text-gray-300 leading-tight">
                    Each location has its own feed, built from posts, updates, and media shared there.
                  </p>
                  <div className="bg-gray-700 rounded mt-1 p-1.5 h-10">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <FiMapPin className="text-green-500 text-xs" />
                        <span className="text-[9px] text-gray-300">Tokyo, Japan</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <FiMapPin className="text-orange-500 text-xs" />
                        <span className="text-[9px] text-gray-300">New York, USA</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <FiMapPin className="text-blue-500 text-xs" />
                        <span className="text-[9px] text-gray-300">London, UK</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <FiMapPin className="text-pink-500 text-xs" />
                        <span className="text-[9px] text-gray-300">Paris, France</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <FiMapPin className="text-yellow-500 text-xs" />
                        <span className="text-[9px] text-gray-300">Sydney, Australia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold mb-0.5">Stay Connected</h3>
                  <p className="text-[10px] text-gray-300 leading-tight">
                    Follow people to get their stories in your personal feed—no borders, no noise.
                  </p>
                  <div className="bg-gray-700 rounded mt-1 p-1.5 h-10">
                    <div className="text-[9px] font-semibold mb-1 text-gray-200">Following</div>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-3 h-3 bg-gray-600 rounded" />
                        <span className="text-[9px] text-gray-300">@sarah_tokyo</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-3 h-3 bg-gray-600 rounded" />
                        <span className="text-[9px] text-gray-300">@mike_nyc</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-3 h-3 bg-gray-600 rounded" />
                        <span className="text-[9px] text-gray-300">@lisa_london</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-3 h-3 bg-gray-600 rounded" />
                        <span className="text-[9px] text-gray-300">@james_paris</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-3 h-3 bg-gray-600 rounded" />
                        <span className="text-[9px] text-gray-300">@emma_sydney</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
