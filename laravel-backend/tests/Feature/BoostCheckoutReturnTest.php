<?php

namespace Tests\Feature;

use App\Services\StripeCheckoutSessionLookup;
use Stripe\Checkout\Session;
use Tests\TestCase;

class BoostCheckoutReturnTest extends TestCase
{
    public function test_success_page_deep_links_only_after_a_paid_session(): void
    {
        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) {
            $mock->shouldReceive('find')
                ->once()
                ->with('cs_test_paid1234')
                ->andReturn(Session::constructFrom([
                    'id' => 'cs_test_paid1234',
                    'payment_status' => 'paid',
                ]));
        });

        $this->get('/boost/success?session_id=cs_test_paid1234')
            ->assertOk()
            ->assertSee('Payment Successful!', false)
            ->assertSee('Boost is being activated...', false)
            ->assertSee('gazetteer://boost/success?session_id=', false)
            ->assertSee('window.location.href = appUrl;', false)
            ->assertSee('Open Gazetteer App', false);
    }

    public function test_success_page_does_not_deep_link_when_payment_is_unpaid(): void
    {
        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) {
            $mock->shouldReceive('find')
                ->once()
                ->andReturn(Session::constructFrom([
                    'id' => 'cs_test_unpaid123',
                    'payment_status' => 'unpaid',
                ]));
        });

        $this->get('/boost/success?session_id=cs_test_unpaid123')
            ->assertOk()
            ->assertSee('Payment not confirmed', false)
            ->assertDontSee('gazetteer://boost/success', false);
    }

    public function test_success_page_ignores_a_missing_or_invalid_session_id(): void
    {
        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) {
            $mock->shouldNotReceive('find');
        });

        $this->get('/boost/success')
            ->assertOk()
            ->assertSee('Payment not confirmed', false)
            ->assertDontSee('gazetteer://boost/success', false);

        $this->get('/boost/success?session_id='.urlencode('cs_test_"><script>'))
            ->assertOk()
            ->assertDontSee('gazetteer://boost/success', false);
    }

    public function test_cancel_page_returns_to_the_app(): void
    {
        $this->get('/boost/cancel')
            ->assertOk()
            ->assertSee('Boost payment was canceled', false)
            ->assertSee('Return to Gazetteer App', false)
            ->assertSee('window.location.href = "gazetteer://boost/cancel";', false)
            ->assertSee('1500', false);
    }
}
