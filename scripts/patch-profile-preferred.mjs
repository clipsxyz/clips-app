import fs from 'fs';

const p = 'src/pages/ProfilePage.tsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  `                  <div className="text-center w-full">
                    <motionless />
                      <motionless />
                      <div className="font-semibold text-sm text-gray-100">Preferences</div>
                    <div className="text-xs text-gray-400 mt-0.5">`,
  `                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Preferences</div>
                    <div className="text-xs text-gray-400 mt-0.5">`
);
s = s.replace(/<motionless \/>/g, '');

const startMarker = "Places You've Traveled To";
const start = s.indexOf(startMarker);
if (start === -1) {
  console.error('start marker not found');
  process.exit(1);
}
const blockStart = s.lastIndexOf('<div>', start);
const blockEnd = s.indexOf('{user.placesTraveled && user.placesTraveled.length > 0', start);
const afterBlock = s.indexOf(')}', blockEnd) + 2;

const replacement = `                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred locations for suggestions
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Optional — places you like or have visited. Your main feed still follows your home location.
                      </p>
                      <PlaceAutocompleteField
                        value={preferredLocationQuery}
                        onChange={setPreferredLocationQuery}
                        onSelectSuggestion={addPreferredLocation}
                        mode="location"
                        showIcon
                        placeholder="Search city or neighborhood"
                        inputClassName="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 py-3 text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      {preferredLocations.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {preferredLocations.map((place) => (
                            <span
                              key={place}
                              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800"
                            >
                              {place}
                              <button
                                type="button"
                                onClick={() => removePreferredLocation(place)}
                                className="text-gray-400 hover:text-gray-700"
                                aria-label={\`Remove \${place}\`}
                              >
                                <FiX className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {preferredLocations.length}/12 added. Pick from search suggestions.
                      </p>
                    </div>`;

s = s.slice(0, blockStart) + replacement + s.slice(afterBlock);
s = s.replace(
  "const places = placesTraveled.split(',').map(p => p.trim()).filter(p => p);",
  'const places = preferredLocations.slice(0, 12);'
);

fs.writeFileSync(p, s);
console.log('patched ProfilePage');
