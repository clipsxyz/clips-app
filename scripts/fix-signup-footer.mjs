import fs from 'fs';

const p = 'src/pages/LoginPage.tsx';
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('            </div>\n          </>\n        )}\n\n        \n\n          </div>');
if (start < 0) {
  console.error('start not found');
  process.exit(1);
}
const sliceFrom = s.indexOf('\n\n        \n\n          </div>', start);
const end = s.indexOf('      </form>', sliceFrom);

const footer = `
            </motionless>
          </motionless>

          <motionless />
            <motionless />
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
                  ? 'Creating account…'
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
`.replace(
  `            </motionless>
          </motionless>

          <motionless />
            <motionless />`,
  `            </div>
          </motionless>

          <motionless />
            <motionless />`.replace(
    '<motionless />',
    '<div className="flex-shrink-0 border-t border-white/10 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">\n            <div className="mx-auto w-full max-w-[400px] space-y-3">'
  ).replace('</motionless>', '</motionless>').replace(
    '          </motionless>',
    '          </div>'
  )
);

// simpler approach - build footer cleanly
const cleanFooter = `
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-white/10 bg-black px-6 sm:px-10 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-[400px] space-y-3">
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
                  ? 'Creating account…'
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
              <div className="mt-1 space-y-1.5">
                <p className="text-[11px] text-center text-gray-500">
                  By signing up, you confirm that you are at least 13 years old and agree to our Terms and Conditions and Community Guidelines.
                </p>
                <motionless />
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
`.replace(
  '<motionless />',
  '<motionless />'
).replace(
  `              <motionless />
                  <Link`,
  `              <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400">
                  <Link`
);

s = s.slice(0, sliceFrom) + cleanFooter + s.slice(end);
fs.writeFileSync(p, s);
console.log('ok', end);
