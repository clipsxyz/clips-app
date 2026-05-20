import fs from 'fs';

const p = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(p, 'utf8');

// Fix broken reference
s = s.replaceAll('signupStepLabel', 'signupStepTitle');

// Header block
const h0 = s.indexOf('          {/* Header */}');
const h1 = s.indexOf('        {signupError &&', h0);
if (h0 < 0 || h1 < 0) throw new Error('header bounds');

const header = `          {/* Header */}
          <div className="flex-shrink-0 px-6 sm:px-10 pt-6 sm:pt-10 pb-2">
            <motionless />
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
                  style={{ width: \`\${(step / 3) * 100}%\` }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable fields */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="mx-auto w-full max-w-[400px] space-y-4 px-6 sm:px-10 pb-4">
`.replace('<motionless />', '<div className="mx-auto w-full max-w-[400px] text-center">');

s = s.slice(0, h0) + header + s.slice(h1);

// Close inner scroll wrapper before footer
const foot = s.indexOf('\n          <div className="flex-shrink-0 border-t border-gray-700 bg-black');
if (foot < 0) throw new Error('footer');
s =
  s.slice(0, foot) +
  '\n            </div>\n          </div>\n\n          <div className="flex-shrink-0 border-t border-white/10 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">\n            <div className="mx-auto w-full max-w-[400px] space-y-3">' +
  s.slice(foot + '\n          <motionless />'.length);

// fix if slice wrong - find exact footer line
if (s.includes('border-gray-700 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3')) {
  s = s.replace(
    'border-gray-700 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3',
    'border-white/10 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
  );
  // may have duplicated - read file after
}

// Footer buttons order + styles
s = s.replace(
  `              <button
                type="submit"
                disabled={
                  signupSubmitting ||
                  (step === 1 && !step1CanContinue) ||
                  (step === 2 && !step2CanContinue)
                }
                className="w-full px-4 py-3 bg-white text-[#111827] rounded-xl transition-colors text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signupSubmitting
                  ? 'Creating account?'
                  : step < 3
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
              )}`,
  `              {step > 1 && (
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
                  ? 'Creating account…'
                  : step < 3
                    ? 'Continue'
                    : 'Create account'}
              </button>`
);

// Close footer max-w wrapper before form end
s = s.replace(
  `              </div>
          </motionless>
      </form>`,
  `              </div>
            </div>
          </div>
      </form>`
);
s = s.replace(
  `              </div>
          </div>
      </form>`,
  `              </motionless>
            </div>
          </div>
      </form>`.replace('<motionless>', '</div>')
);

const inputOld =
  'w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white';
s = s.split(inputOld).join('{signupInputClass}');

const inputOldPr10 =
  'w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2 sm:py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-white';
s = s.split(inputOldPr10).join('{signupInputClass} pr-10');

const selectOld =
  'w-full rounded-xl border-2 border-white bg-gray-50 dark:bg-gray-900 px-3 py-2.5 pr-8 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-white appearance-none';
s = s.split(selectOld).join('{signupInputClass} pr-8 appearance-none');

s = s.replace('className={`${signupPlaceInputClass} pl-10`}', 'className={signupPlaceInputClass}');
s = s.replaceAll(
  'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
  'text-gray-500 hover:text-gray-300'
);

// Account type
s = s.replace(
  `            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-gray-400 mb-2">Account type</p>
              <div className="grid grid-cols-2 gap-2">`,
  `            <div className="space-y-2">
              <p className="text-xs text-gray-500">Account type</p>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1">`
);
s = s.replaceAll('relative rounded-sm border px-3 py-2 text-xs', 'relative rounded-md px-3 py-2.5 text-xs');
s = s.replaceAll('border-[#8ab4ff] bg-[#8ab4ff]/15 text-[#dce9ff]', 'bg-[#7A8AF0]/20 text-white');
s = s.replaceAll('border-white/15 bg-black/30 text-gray-300 hover:bg-white/5', 'text-gray-400 hover:text-gray-200');
s = s.replace(
  '<p className="mt-1 text-[11px] text-gray-500">Business accounts are eligible for local business suggestion cards.</p>',
  `{accountType === 'business' && (
                <p className="text-xs text-gray-500">Eligible for local business suggestion cards.</p>
              )}`
);

s = s.replace(
  '<p className="text-xs text-gray-500 mb-1.5 px-1">8+ characters, include a number or symbol</p>\n              <div className="relative">',
  '<div className="relative">'
);
s = s.replace('placeholder="Password"', 'placeholder="Password (8+ characters)"');

s = s.replace(
  '<p className="text-xs text-gray-400 mb-2 px-1">Date of birth (you must be 13 or older)</p>',
  '<p className="text-xs text-gray-500 mb-2">Date of birth</p>'
);

s = s.replace(
  `<p className="text-xs text-gray-400 mb-2 px-1">
                Your home location powers your feeds. Pick a place so we set your{' '}
                <span className="text-gray-300">local</span>, <span className="text-gray-300">regional</span>, and{' '}
                <span className="text-gray-300">national</span> areas.
              </p>`,
  '<p className="text-xs text-gray-500 mb-2">Home location — local, regional, and national feeds.</p>'
);

s = s.replace(
  /<p className="mt-1\.5 text-\[11px\] text-gray-500 px-1">[\s\S]*?automatically\.<\/p>\s*/m,
  ''
);
s = s.replace(
  'Select a place from the list to confirm local, regional, and national feeds.',
  'Select a suggestion from the list.'
);
s = s.replace('text-[11px] text-amber-300/90 px-1', 'text-xs text-amber-300/90');

const locBox = `                <div className="mt-2 rounded-xl border border-[#8ab4ff]/25 bg-[#8ab4ff]/8 px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] text-[#dce9ff] flex items-center gap-1.5">
                    <FiCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Home area saved ? country, city, and local news feeds
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
                </div>`;

const locInline = `                <motionless />
                  <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7A8AF0]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-white">Home area set</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {signupFeedTierRows(local, regional, national)
                        .map((row) => row.value)
                        .join(' · ')}
                    </p>
                    <button
                      type="button"
                      onClick={clearHomeLocation}
                      className="mt-1 text-xs text-[#7A8AF0] hover:underline"
                    >
                      Change location
                    </button>
                  </div>
                </div>`.replace(
  '<motionless />',
  '<div className="mt-2 flex items-start gap-2 text-sm text-gray-300">'
);

if (s.includes(locBox)) s = s.replace(locBox, locInline);

// Step 3
const s3a = `            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 mb-1">
              <p className="text-[11px] text-gray-400">Signing up as</p>
              <p className="text-sm text-white font-medium flex items-center gap-1.5 mt-0.5">
                <span>@{handlePreview}</span>
                {previewCountryFlag ? <Flag value={previewCountryFlag} national={national} size={16} /> : null}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">{local} ? {regional} ? {national}</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/5 px-3 py-4">
              <p className="text-[11px] text-gray-400 mb-3">Profile picture (optional)</p>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-800 border border-white/20 flex items-center justify-center text-xs text-gray-200">`;

const s3b = `            <p className="text-center text-sm text-gray-400">
              <span className="font-medium text-white">@{handlePreview}</span>
              {previewCountryFlag ? (
                <span className="ml-1.5 inline-flex align-middle">
                  <Flag value={previewCountryFlag} national={national} size={16} />
                </span>
              ) : null}
              <span className="mt-1 block truncate text-xs text-gray-500">
                {[local, regional, national].filter(Boolean).join(' · ')}
              </span>
            </p>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/5 text-lg text-gray-200">`;

if (s.includes(s3a)) {
  s = s.replace(s3a, s3b);
  s = s.replace(
    `<label className="inline-flex cursor-pointer items-center rounded-xl border border-white/25 px-3 py-2 text-xs text-white hover:bg-white/5">
                  Choose photo`,
    `<label className="inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5">
                  Choose photo`
  );
  s = s.replace(
    `                {profilePicture && (
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
            </div>`,
    `              </div>
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
              <p className="text-center text-xs text-gray-500">Optional — initials are used if you skip.</p>
            </div>`
  );
  // step3 replace may duplicate choose photo - verify file
}

fs.writeFileSync(p, s);
console.log('patched');
