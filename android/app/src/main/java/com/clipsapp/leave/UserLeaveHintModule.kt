package com.clipsapp.leave

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class UserLeaveHintModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UserLeaveHint"

    @ReactMethod
    fun consume(promise: Promise) {
        val left = UserLeaveHintStore.pending
        UserLeaveHintStore.pending = false
        promise.resolve(left)
    }
}
