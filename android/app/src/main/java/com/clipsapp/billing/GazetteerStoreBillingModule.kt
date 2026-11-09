package com.clipsapp.billing

import android.app.Activity
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * Opens the Google Play purchase sheet for the gazetteer_boost product.
 * Play charges the price configured for that product. The quote amount travels with the call
 * so a later receipt check can compare it.
 */
class GazetteerStoreBillingModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), PurchasesUpdatedListener {

    private var pending: Promise? = null
    private var client: BillingClient? = null

    override fun getName(): String = "GazetteerStoreBilling"

    @ReactMethod
    fun purchase(payload: ReadableMap, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Open the app to pay with Google Play")
            return
        }
        if (pending != null) {
            promise.reject("BUSY", "A store payment is already open")
            return
        }
        pending = promise
        val productId = if (payload.hasKey("productId")) payload.getString("productId") else null
        val billing = BillingClient.newBuilder(reactApplicationContext)
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build(),
            )
            .build()
        client = billing
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    fail("BILLING_UNAVAILABLE", result.debugMessage.ifBlank { "Google Play billing is unavailable" })
                    return
                }
                queryAndLaunch(activity, billing, productId ?: "gazetteer_boost")
            }

            override fun onBillingServiceDisconnected() {
            }
        })
    }

    private fun queryAndLaunch(activity: Activity, billing: BillingClient, productId: String) {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.INAPP)
            .build()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()
        billing.queryProductDetailsAsync(params) { result, details ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK || details.isEmpty()) {
                fail("NO_PRODUCT", "Google Play has no boost product for this build")
                return@queryProductDetailsAsync
            }
            val flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(details[0])
                            .build(),
                    ),
                )
                .build()
            activity.runOnUiThread {
                val launched = billing.launchBillingFlow(activity, flow)
                if (launched.responseCode != BillingClient.BillingResponseCode.OK) {
                    fail("LAUNCH_FAILED", launched.debugMessage.ifBlank { "Could not open Google Play" })
                }
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val token = purchases?.firstOrNull()?.purchaseToken ?: ""
                pending?.resolve(Arguments.createMap().apply { putString("purchaseToken", token) })
                pending = null
                client?.endConnection()
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                pending?.reject("CANCELED", "Payment cancelled")
                pending = null
                client?.endConnection()
            }
            else -> fail("PURCHASE_FAILED", result.debugMessage.ifBlank { "Google Play did not complete the payment" })
        }
    }

    private fun fail(code: String, message: String) {
        pending?.reject(code, message)
        pending = null
        client?.endConnection()
    }
}
