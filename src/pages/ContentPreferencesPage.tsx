import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiSave } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { updateAuthProfile, mapLaravelUserToAppFields } from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { showToast } from '../utils/toast';
import type { User } from '../types';

export default function ContentPreferencesPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [locationsInput, setLocationsInput] = React.useState(user?.placesTraveled?.join(', ') || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [hiddenPlaces, setHiddenPlaces] = React.useState<string[]>([]);
  const [hiddenBusinesses, setHiddenBusinesses] = React.useState<string[]>([]);
  const [likedBusinesses, setLikedBusinesses] = React.useState<string[]>([]);

  React.useEffect(() => {
    setLocationsInput(user?.placesTraveled?.join(', ') || '');
  }, [user?.placesTraveled]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('clips:suggestedPlacesDislikedPlaces');
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setHiddenPlaces(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
      setHiddenPlaces([]);
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('clips:hiddenBusinessSuggestions');
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setHiddenBusinesses(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
      setHiddenBusinesses([]);
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('clips:likedBusinessSuggestions');
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setLikedBusinesses(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
      setLikedBusinesses([]);
    }
  }, []);

  const parsedLocations = React.useMemo(() => {
    return locationsInput
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12);
  }, [locationsInput]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const nextPlaces = parsedLocations.length > 0 ? parsedLocations : undefined;
    const optimisticUser: User = { ...user, placesTraveled: nextPlaces };
    login(optimisticUser);

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (token && isLaravelApiEnabled()) {
        const apiUser = await updateAuthProfile({
          places_traveled: parsedLocations,
        });
        const mapped = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
        const merged: User = { ...optimisticUser };
        for (const [key, val] of Object.entries(mapped)) {
          if (val === undefined || val === null) continue;
          if (key === 'placesTraveled' && Array.isArray(val)) {
            merged.placesTraveled = val.length > 0 ? val : undefined;
            continue;
          }
          (merged as Record<string, unknown>)[key] = val;
        }
        login(merged);
      }
      showToast?.('Suggestion preferences saved');
      navigate(-1);
    } catch (error) {
      console.error('Failed saving content preferences:', error);
      showToast?.('Saved locally. Could not sync to server right now.');
      navigate(-1);
    } finally {
      setIsSaving(false);
    }
  };

  const removeHiddenPlace = (place: string) => {
    const target = place.trim().toLowerCase();
    const next = hiddenPlaces.filter((p) => p.trim().toLowerCase() !== target);
    setHiddenPlaces(next);
    try {
      localStorage.setItem('clips:suggestedPlacesDislikedPlaces', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    showToast?.('Removed hidden place');
  };

  const clearHiddenPlaces = () => {
    setHiddenPlaces([]);
    try {
      localStorage.setItem('clips:suggestedPlacesDislikedPlaces', JSON.stringify([]));
    } catch {
      /* ignore */
    }
    showToast?.('Reset hidden places');
  };

  const removeHiddenBusiness = (key: string) => {
    const target = key.trim().toLowerCase();
    const next = hiddenBusinesses.filter((p) => p.trim().toLowerCase() !== target);
    setHiddenBusinesses(next);
    try {
      localStorage.setItem('clips:hiddenBusinessSuggestions', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    showToast?.('Removed hidden business');
  };

  const clearHiddenBusinesses = () => {
    setHiddenBusinesses([]);
    try {
      localStorage.setItem('clips:hiddenBusinessSuggestions', JSON.stringify([]));
    } catch {
      /* ignore */
    }
    showToast?.('Reset hidden businesses');
  };

  const removeLikedBusiness = (key: string) => {
    const target = key.trim().toLowerCase();
    const next = likedBusinesses.filter((p) => p.trim().toLowerCase() !== target);
    setLikedBusinesses(next);
    try {
      localStorage.setItem('clips:likedBusinessSuggestions', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    showToast?.('Removed liked business preference');
  };

  const clearLikedBusinesses = () => {
    setLikedBusinesses([]);
    try {
      localStorage.setItem('clips:likedBusinessSuggestions', JSON.stringify([]));
    } catch {
      /* ignore */
    }
    showToast?.('Cleared liked business preferences');
  };

  return (
    <div className="min-h-full bg-black text-white px-4 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-white/10 p-2">
              <FiMapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Preferred Locations</h1>
              <p className="mt-1 text-sm text-white/70">
                Improve feed suggestions by adding places you like or traveled to.
              </p>
            </div>
          </div>

          <label className="mb-1 block text-xs text-white/70">Locations (comma separated)</label>
          <textarea
            value={locationsInput}
            onChange={(e) => setLocationsInput(e.target.value)}
            rows={4}
            placeholder="Dublin, Barcelona, New York"
            className="w-full rounded-xl border border-white/20 bg-black/55 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/45"
          />
          <p className="mt-2 text-xs text-white/55">Up to 12 places. Example: city, county, country, landmark.</p>

          {parsedLocations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {parsedLocations.map((place) => (
                <span key={place} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs">
                  {place}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save Preferences'}
          </button>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Hidden suggestion places</h2>
              {hiddenPlaces.length > 0 && (
                <button
                  type="button"
                  onClick={clearHiddenPlaces}
                  className="text-xs text-white/80 underline hover:text-white"
                >
                  Reset hidden
                </button>
              )}
            </div>
            {hiddenPlaces.length === 0 ? (
              <p className="text-xs text-white/55">No hidden places yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hiddenPlaces.map((place) => (
                  <button
                    key={place}
                    type="button"
                    onClick={() => removeHiddenPlace(place)}
                    className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs hover:bg-white/15"
                    title="Remove from hidden suggestions"
                  >
                    {place} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Hidden business suggestions</h2>
              {hiddenBusinesses.length > 0 && (
                <button
                  type="button"
                  onClick={clearHiddenBusinesses}
                  className="text-xs text-white/80 underline hover:text-white"
                >
                  Reset hidden
                </button>
              )}
            </div>
            {hiddenBusinesses.length === 0 ? (
              <p className="text-xs text-white/55">No hidden businesses yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hiddenBusinesses.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => removeHiddenBusiness(key)}
                    className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs hover:bg-white/15"
                    title="Remove from hidden business suggestions"
                  >
                    {key} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Liked business suggestions</h2>
              {likedBusinesses.length > 0 && (
                <button
                  type="button"
                  onClick={clearLikedBusinesses}
                  className="text-xs text-white/80 underline hover:text-white"
                >
                  Clear likes
                </button>
              )}
            </div>
            {likedBusinesses.length === 0 ? (
              <p className="text-xs text-white/55">No liked businesses yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {likedBusinesses.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => removeLikedBusiness(key)}
                    className="rounded-full border border-[#8ab4ff]/40 bg-[#8ab4ff]/10 px-2.5 py-1 text-xs text-[#d8e6ff] hover:bg-[#8ab4ff]/20"
                    title="Remove from liked business suggestions"
                  >
                    {key} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
