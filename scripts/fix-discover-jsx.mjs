import fs from 'fs';

const p = 'src/pages/DiscoverPage.tsx';
let s = fs.readFileSync(p, 'utf8');

const motionClose = '</' + 'motion.div>';

s = s.replace(
    '                    </div>\n                ' + motionClose + '\n\n                <div className="mt-auto',
    '                    </div>\n                </div>\n\n                <motion.div className="mt-auto'
);

s = s.replace(
    '<' + 'motion.div className="absolute bottom-full',
    '<div className="absolute bottom-full'
);

s = s.replace(
    '{suggestionList}\n                            ' + motionClose + '\n                        )}\n                        <FiSearch',
    '{suggestionList}\n                            </div>\n                        )}\n                        <FiSearch'
);

s = s.replace(
    '{suggestionList}\n                            ' + motionClose + '\n                        )}\n                        {!keyboardLayout',
    '{suggestionList}\n                            </div>\n                        )}\n                        {!keyboardLayout'
);

s = s.replace(
    '                        />\n                    ' + motionClose + '\n                ' + motionClose + '\n            ' + motionClose,
    '                        />\n                    </div>\n                </div>\n            </div>'
);

s = s.replace('<' + 'motion.div className="fixed inset-0', '<div className="fixed inset-0');
s = s.replace('<' + 'motion.div className="w-full max-w-md rounded-2xl', '<div className="w-full max-w-md rounded-2xl');
s = s.replace('<' + 'motion.div className="mt-4 flex flex-col gap-2">', '<div className="mt-4 flex flex-col gap-2">');
s = s.replace(
    '                        ' + motionClose + '\n                        <button\n                            type="button"\n                            onClick={() => setScopePicker(null)}',
    '                        </div>\n                        <button\n                            type="button"\n                            onClick={() => setScopePicker(null)}'
);
s = s.replace(
    '                        </button>\n                    ' + motionClose + '\n                ' + motionClose + '\n            )}\n        ' + motionClose,
    '                        </button>\n                    </div>\n                </div>\n            )}\n        </div>'
);

fs.writeFileSync(p, s);
console.log('fixed');
