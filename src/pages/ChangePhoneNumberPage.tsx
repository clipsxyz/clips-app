import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { sendPhoneVerificationCode, verifyPhoneVerificationCode } from '../api/client';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet';

function toE164(countryCode: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D+/g, '');
  const rawCode = countryCode.trim();
  const code = rawCode.startsWith('+') ? rawCode : `+${rawCode.replace(/\D+/g, '')}`;
  return `${code}${digits}`;
}

export default function ChangePhoneNumberPage() {
  const nav = useNavigate();
  const [step, setStep] = React.useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = React.useState('+353');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [otpInput, setOtpInput] = React.useState('');
  const [pendingPhone, setPendingPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ title: string; message: string; icon: 'success' | 'alert' | 'info'; onConfirm?: () => void } | null>(null);

  const sendCode = async () => {
    if (busy) return;
    const phone = toE164(countryCode, phoneInput);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setNotice({ title: 'Invalid number', message: 'Enter a valid phone number, including the country code.', icon: 'alert' });
      return;
    }
    setBusy(true);
    try {
      await sendPhoneVerificationCode(phone);
      setPendingPhone(phone);
      setOtpInput('');
      setStep('code');
    } catch (error: any) {
      setNotice({ title: 'Send failed', message: error?.message || 'Could not verify that phone number.', icon: 'alert' });
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (busy) return;
    const code = otpInput.replace(/\D+/g, '');
    if (code.length !== 6) {
      setNotice({ title: 'Invalid code', message: 'Enter the 6-digit code.', icon: 'alert' });
      return;
    }
    setBusy(true);
    try {
      const saved = await verifyPhoneVerificationCode(pendingPhone, code);
      const shown = saved.phone_number || pendingPhone;
      setNotice({
        title: 'Phone updated',
        message: `Your number is now ${shown}.`,
        icon: 'success',
        onConfirm: () => nav(-1),
      });
    } catch (error: any) {
      setNotice({ title: 'Update failed', message: error?.message || 'Could not verify that phone number.', icon: 'alert' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3">
        <button type="button" onClick={() => nav(-1)} disabled={busy} className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-60">
          <FiArrowLeft className="h-[18px] w-[18px]" />
          Back
        </button>
        <h1 className="text-base font-bold">Change phone</h1>
        <div className="w-[50px]" />
      </div>
      <div className="m-4 rounded-2xl border border-white/10 bg-[rgba(26,21,36,0.92)] p-4">
        {step === 'phone' ? (
          <>
            <h2 className="text-xl font-bold">New phone number</h2>
            <p className="mt-2 text-sm leading-5 text-[#D1D5DB]">
              We&apos;ll text a 6-digit code to this number. Your Gazetteer account stays signed in.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                placeholder="+353"
                inputMode="tel"
                className="w-[84px] rounded-xl border border-white/[0.12] bg-[rgba(24,24,28,0.65)] px-3 py-3 text-base text-white outline-none placeholder:text-[#9CA3AF]"
              />
              <input
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="Phone number"
                inputMode="tel"
                className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-[rgba(24,24,28,0.65)] px-3 py-3 text-base text-white outline-none placeholder:text-[#9CA3AF]"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendCode()}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#6EE7B7] text-base font-bold text-[#0A194E] disabled:opacity-60"
            >
              {busy ? 'Sending...' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Enter 6-digit code</h2>
            <p className="mt-2 text-sm leading-5 text-[#D1D5DB]">Your code was sent to {pendingPhone}</p>
            <input
              value={otpInput}
              onChange={(event) => setOtpInput(event.target.value.replace(/\D+/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="mt-4 w-full rounded-xl border border-white/[0.12] bg-[rgba(24,24,28,0.65)] px-3 py-3.5 text-center text-2xl tracking-[6px] text-white outline-none placeholder:text-[#9CA3AF]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmCode()}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#6EE7B7] text-base font-bold text-[#0A194E] disabled:opacity-60"
            >
              {busy ? 'Updating...' : 'Update number'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('phone');
                setOtpInput('');
              }}
              className="mt-3 w-full py-2.5 text-center text-sm font-semibold text-[#D1D5DB] disabled:opacity-60"
            >
              Use a different number
            </button>
          </>
        )}
      </div>
      <GazetteerAlertSheet
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message}
        icon={notice?.icon ?? 'alert'}
        showIcon={false}
        confirmButtonText="OK"
        onConfirm={() => {
          const action = notice?.onConfirm;
          setNotice(null);
          action?.();
        }}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}
