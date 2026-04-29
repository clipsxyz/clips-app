# Mobile Release QA Checklist (iOS + Android)

Status key: `[ ] NOT TESTED` `[x] PASS` `[-] FAIL`

Use this checklist to confirm the app is truly ship-ready on physical phones after the parity work.

## 1) Build + Install
- [ ] Android debug build installs and launches on a real device.
- [ ] Android release build installs and launches on a real device.
- [ ] iOS debug build installs and launches on a real device.
- [ ] iOS release build installs and launches on a real device.
- [ ] App opens without red screen/crash on cold start.

## 2) Auth + Onboarding
- [ ] Sign up completes end-to-end.
- [ ] Login works with existing account.
- [ ] Logout works and returns to login screen.
- [ ] Re-login after logout restores session cleanly.

## 3) Main Feed + Cards
- [ ] Header actions work: Boost, filter dropdown, Inbox.
- [ ] Feed filter switching updates content correctly.
- [ ] Story rail opens stories and marks viewed correctly.
- [ ] Card actions work: like, comment, share, bookmark, reclip.
- [ ] Post media loads reliably (image/video/text cards).

## 4) Stories
- [ ] Story viewer opens from all entry points.
- [ ] Hold-to-pause works without browser/system context menu interference.
- [ ] Link sticker flow works (visit confirmation/open link).
- [ ] Mute icon appears only for video stories.
- [ ] Story replies/reactions post and appear in inbox/insights correctly.

## 5) Messages + Inbox
- [ ] DM list loads and opens conversations.
- [ ] Send text, image, and audio message successfully.
- [ ] Voice recording permission flow works (allow/deny).
- [ ] Reactions, swipe-to-reply, copy text, forward actions work.
- [ ] Inbox notification rows open correct targets (story/profile/message).
- [ ] Follow request accept/deny works from inbox.

## 6) Profile + Create + Discover/Search
- [ ] Edit Profile saves name/bio/website.
- [ ] Privacy toggle and settings toggles persist after restart.
- [ ] Drafts reopen into Create with expected metadata.
- [ ] Create post works for image/video/text with location + tags.
- [ ] Video trim/cover controls behave correctly.
- [ ] Search and Discover mode routing works (location/venue/landmark/nearby).

## 7) Platform-Specific Device Checks
- [ ] Android: back button behavior is correct across tabs/modals.
- [ ] Android: camera, gallery, microphone permissions handle deny/grant gracefully.
- [ ] iOS: camera, gallery, microphone permissions handle deny/grant gracefully.
- [ ] Deep links / notification taps route to the correct screen.
- [ ] No layout breakage on small and large device sizes.

## 8) Stability + Performance
- [ ] No critical console errors during a 10-15 minute exploratory session.
- [ ] No obvious jank/freeze during feed scroll, stories, and messages.
- [ ] App survives background/foreground cycles without state corruption.
- [ ] App survives force-close + cold restart without broken navigation.

## 9) Release Readiness Gate
- [ ] All critical items above are passing on both iOS and Android.
- [ ] Any known issues are documented with severity and workaround.
- [ ] Decision: **READY TO SHIP** / **HOLD RELEASE**.

---

### Live Run Sheet (fill while testing)

#### Device Matrix
- iOS device + OS:
- Android device + OS:
- App build/version:
- Tester:
- Date:

#### Failures / Notes Log
- Item:
  - Platform:
  - Result:
  - Notes:
- Item:
  - Platform:
  - Result:
  - Notes:
- Item:
  - Platform:
  - Result:
  - Notes:

#### Final Decision
- iOS final: `NOT TESTED / PASS / FAIL`
- Android final: `NOT TESTED / PASS / FAIL`
- Release decision: `READY TO SHIP / HOLD RELEASE`
