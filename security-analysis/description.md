Setup: 
2 Android phones, password and username setup, Space already created and joined, User A shares a transaction ("Super secret message 🕵️", -5 USD) to the Space, User B received it.

Logs on User A's device (Including the needed keys):
```shell
04-17 03:24:02.619 30199 30282 I ReactNativeJS: [P2P] Provider initialized
04-17 03:24:02.643 30199 30282 I ReactNativeJS: [P2P] Reopened 1 space(s)
04-17 03:24:02.644 30199 30307 I punch.bare.expo: [Backend] Opening Space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:04.175 30199 30307 I punch.bare.expo: TX key: c91d732673ae381862dbc01a315d09b5a2f854382931123a86098e177efa0931
04-17 03:24:04.175 30199 30307 I punch.bare.expo: RX key: 540f6c12071ce4bc7ca0596c13ee7ebae9d5f883f015f571fe21999293eff4b0
04-17 03:24:04.603 30199 30307 I punch.bare.expo: [Space] Ready: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:04.603 30199 30307 I punch.bare.expo: [SpaceManager] Opened space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:04.603 30199 30307 I punch.bare.expo: [Backend] Opened Space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:19.314  7852 18811 I FASProvider: makeValuesForFasUpdate contentValues = package_name=to.holepunch.bare.expo extras=0 reason=deleted_from_mars_auto disableReason=deleted_from_mars_auto disableResetTime=1776389059313 uid=10081 mode=0 level=1 resetTime=0
04-17 03:24:19.315  3150  5475 I SystemKeyManager: requested systemKeyInfo size=1 focusedWindow=to.holepunch.bare.expo/to.holepunch.bare.expo.MainActivity
04-17 03:24:19.315  3150  5475 I SystemKeyManager: requested systemKeyInfo size=2 focusedWindow=to.holepunch.bare.expo/to.holepunch.bare.expo.MainActivity
04-17 03:24:24.563 30199 30307 I punch.bare.expo: [Backend] Appending share transaction: txn_1776388932303_8fscjinvq
04-17 03:24:24.563 30199 30307 I punch.bare.expo: Appending share transaction operation to space: 1c4942e7-f6f5-453f-8c69-a503c464b808 operation ID: txn_1776388932303_8fscjinvq
04-17 03:24:24.563 30199 30307 I punch.bare.expo: [Space] Appending operation: @p2p/share-transaction to space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:24.565 30199 30307 I punch.bare.expo: Encoded operation for append: @p2p/share-transaction 154 bytes
04-17 03:24:24.566 30199 30307 I punch.bare.expo: [Space] Processing batch of 1 operations for space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:24.567 30199 30307 I punch.bare.expo: [Hyperdispatch] Received share-transaction: txn_1776388932303_8fscjinvq for space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:24.586 30199 30307 I punch.bare.expo: [Space] Appended operation: @p2p/share-transaction to space: 1c4942e7-f6f5-453f-8c69-a503c464b808
04-17 03:24:24.604  7852 18811 I FASProvider: makeValuesForFasUpdate contentValues = package_name=to.holepunch.bare.expo extras=0 reason=deleted_from_mars_auto disableReason=deleted_from_mars_auto disableResetTime=1776389064603 uid=10081 mode=0 level=1 resetTime=0
04-17 03:24:24.605  3150  6970 I SystemKeyManager: requested systemKeyInfo size=1 focusedWindow=to.holepunch.bare.expo/to.holepunch.bare.expo.MainActivity
04-17 03:24:24.605  3150  6970 I SystemKeyManager: requested systemKeyInfo size=2 focusedWindow=to.holepunch.bare.expo/to.holepunch.bare.expo.MainActivity
04-17 03:24:24.652 30199 30282 I ReactNativeJS: '[P2P] Received syncShareTransaction:', 'txn_1776388932303_8fscjinvq'
```