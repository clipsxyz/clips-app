package com.clipsapp.leave

/**
 * Set only when the user leaves via Home or Recents.
 * A gallery picker, camera intent, or screen-record sheet does not set this.
 */
object UserLeaveHintStore {
    @Volatile
    var pending: Boolean = false
}
