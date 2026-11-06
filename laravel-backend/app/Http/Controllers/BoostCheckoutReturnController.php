<?php

namespace App\Http\Controllers;

use App\Services\StripeCheckoutSessionLookup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

class BoostCheckoutReturnController extends Controller
{
    public function success(Request $request, StripeCheckoutSessionLookup $sessions): View
    {
        $sessionId = trim((string) $request->query('session_id', ''));
        $confirmedId = null;

        if ($this->isCheckoutSessionId($sessionId)) {
            try {
                $session = $sessions->find($sessionId);
                if (($session->payment_status ?? null) === 'paid') {
                    $confirmedId = (string) ($session->id ?: $sessionId);
                }
            } catch (\Throwable $e) {
                Log::warning('Boost checkout return could not be verified', [
                    'session_id' => $sessionId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return view('boost.success', [
            'paid' => $confirmedId !== null,
            'sessionId' => $confirmedId,
        ]);
    }

    public function cancel(): View
    {
        return view('boost.cancel');
    }

    private function isCheckoutSessionId(string $sessionId): bool
    {
        return (bool) preg_match('/\Acs_[A-Za-z0-9_]{8,}\z/', $sessionId);
    }
}
