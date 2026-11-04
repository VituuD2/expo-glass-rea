<!--
{
  "availability" : [
    "iOS: 26.0.0 -",
    "iPadOS: 26.0.0 -",
    "macOS: 26.0.0 -",
    "tvOS: 26.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "BundleResources",
  "identifier" : "/documentation/BundleResources/Information-Property-List/UIDesignRequiresCompatibility",
  "metadataVersion" : "0.1.0",
  "role" : "Property List Key",
  "symbol" : {
    "kind" : "Property List Key",
    "modules" : [
      "Bundle Resources"
    ],
    "preciseIdentifier" : "plist:Information_Property_List.UIDesignRequiresCompatibility"
  },
  "title" : "UIDesignRequiresCompatibility"
}
-->

# UIDesignRequiresCompatibility

A Boolean value that indicates whether the system runs the app using a compatibility mode for UI.

## Discussion

> Warning: Temporarily use this key while reviewing and refining your app’s UI for the design in the latest SDKs.

If `YES`, the system runs the app using a compatibility mode for UI elements. The compatibility mode displays the app as it looks when built against previous versions of the SDKs.

If `NO`, the system uses the UI design of the running OS, with no compatibility mode. Absence of the key, or `NO`, is the default value for apps linking against the latest SDKs.

The system ignores this key when you build for iOS 27 or later, iPadOS 27 or later, Mac Catalyst 27 or later, macOS 27 or later, or tvOS 27 or later.

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)