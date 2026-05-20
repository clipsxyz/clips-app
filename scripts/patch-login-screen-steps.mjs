import fs from 'fs';

const p = 'src/screens/LoginScreen.tsx';
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('                    {/* Step 1: Location */}');
const end = s.indexOf('                    {/* Step 3: Profile Picture */}');
if (start < 0 || end < 0) {
  console.error('markers', start, end);
  process.exit(1);
}

const replacement = `                    {mode === 'signup' && step === 1 && (
                        <View style={styles.stepContent}>
                            <Text style={styles.fieldLabel}>Account type</Text>
                            <View style={styles.accountTypeRow}>
                                <TouchableOpacity
                                    onPress={() => setAccountType('personal')}
                                    style={[styles.accountTypePill, accountType === 'personal' && styles.accountTypePillActive]}
                                >
                                    <Text style={[styles.accountTypeText, accountType === 'personal' && styles.accountTypeTextActive]}>Personal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setAccountType('business')}
                                    style={[styles.accountTypePill, accountType === 'business' && styles.accountTypePillActive]}
                                >
                                    <Text style={[styles.accountTypeText, accountType === 'business' && styles.accountTypeTextActive]}>Business</Text>
                                </TouchableOpacity>
                            </View>
                            {accountType === 'business' ? (
                                <Text style={styles.hintText}>Eligible for local business suggestion cards.</Text>
                            ) : null}
                            {!!getFieldError('accountType') && <Text style={styles.fieldErrorText}>{getFieldError('accountType')}</Text>}

                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email"
                                placeholderTextColor="#6B7280"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {!!getFieldError('email') && <Text style={styles.fieldErrorText}>{getFieldError('email')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Password (8+ characters)"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupPassword((v) => !v)}>
                                    <Icon name={showSignupPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('password') && <Text style={styles.fieldErrorText}>{getFieldError('password')}</Text>}

                            <View style={styles.passwordRow}>
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, { flex: 1 }]}
                                    secureTextEntry={!showSignupConfirmPassword}
                                />
                                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowSignupConfirmPassword((v) => !v)}>
                                    <Icon name={showSignupConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                            {!!getFieldError('confirmPassword') && <Text style={styles.fieldErrorText}>{getFieldError('confirmPassword')}</Text>}
                        </View>
                    )}

                    {mode === 'signup' && step === 2 && (
                        <View style={styles.stepContent}>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                placeholderTextColor="#6B7280"
                                style={styles.input}
                                autoComplete="name"
                            />
                            {!!getFieldError('name') && <Text style={styles.fieldErrorText}>{getFieldError('name')}</Text>}

                            <Text style={styles.fieldLabel}>Date of birth</Text>
                            <View style={styles.birthdateRow}>
                                <View style={[styles.pickerContainer, { flex: 1.2 }]}>
                                    <Picker
                                        selectedValue={birthMonth}
                                        onValueChange={setBirthMonth}
                                        style={styles.picker}
                                        dropdownIconColor="#9CA3AF"
                                    >
                                        <Picker.Item label="Month" value="" color="#9CA3AF" />
                                        {MONTHS.map((m, i) => (
                                            <Picker.Item key={m} label={m} value={String(i + 1)} color="#F9FAFB" />
                                        ))}
                                    </Picker>
                                </View>
                                <TextInput
                                    value={birthDay}
                                    onChangeText={(v) => setBirthDay(v.replace(/\\D/g, '').slice(0, 2))}
                                    placeholder="Day"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, styles.birthInput]}
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                                <TextInput
                                    value={birthYear}
                                    onChangeText={(v) => setBirthYear(v.replace(/\\D/g, '').slice(0, 4))}
                                    placeholder="Year"
                                    placeholderTextColor="#6B7280"
                                    style={[styles.input, styles.birthInputLarge]}
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                            {!!getFieldError('birthdate') && <Text style={styles.fieldErrorText}>{getFieldError('birthdate')}</Text>}

                            <Text style={styles.fieldLabel}>Home location — local, regional, and national feeds.</Text>
                            <PlaceAutocompleteField
                                value={homeLocationQuery}
                                onChange={(v) => {
                                    setHomeLocationQuery(v);
                                    if (local || regional || national) {
                                        setLocal('');
                                        setRegional('');
                                        setNational('');
                                    }
                                }}
                                onSelectSuggestion={applyHomeLocation}
                                showFeedLevels
                                placeholder="Search city or neighborhood"
                            />
                            {!homeLocationComplete && homeLocationQuery.trim().length >= 2 ? (
                                <Text style={styles.warnText}>Select a suggestion from the list.</Text>
                            ) : null}
                            {!!getFieldError('homeLocation') && <Text style={styles.fieldErrorText}>{getFieldError('homeLocation')}</Text>}
                            {homeLocationComplete ? (
                                <View style={styles.locationOk}>
                                    <Icon name="checkmark-circle" size={18} color="#7A8AF0" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.locationOkTitle}>Home area set</Text>
                                        <Text style={styles.locationOkSub}>
                                            {signupFeedTierRows(local, regional, national).map((r) => r.value).join(' · ')}
                                        </Text>
                                        <TouchableOpacity onPress={clearHomeLocation}>
                                            <Text style={styles.linkText}>Change location</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    )}

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log('steps patched');
