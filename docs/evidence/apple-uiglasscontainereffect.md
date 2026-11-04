<!--
{
  "availability" : [
    "iOS: 26.0.0 -",
    "iPadOS: 26.0.0 -",
    "macCatalyst: 26.0.0 -",
    "tvOS: 26.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "UIKit",
  "identifier" : "/documentation/UIKit/UIGlassContainerEffect",
  "metadataVersion" : "0.1.0",
  "role" : "Class",
  "symbol" : {
    "kind" : "Class",
    "modules" : [
      "UIKit"
    ],
    "preciseIdentifier" : "c:objc(cs)UIGlassContainerEffect"
  },
  "title" : "UIGlassContainerEffect"
}
-->

# UIGlassContainerEffect

A `UIGlassContainerEffect` renders multiple glass elements into a combined effect.

```
@MainActor class UIGlassContainerEffect
```

## Overview

When using `UIGlassContainerEffect` with a `UIVisualEffectView` you can
add individual glass elements to the visual effect view’s contentView by nesting `UIVisualEffectView`‘s
configured with `UIGlassEffect`. In that configuration, the glass container will render all glass elements
in one combined view, behind the visual effect view’s `contentView`.

## Topics

### Instance Properties

[`var spacing: CGFloat`](/documentation/UIKit/UIGlassContainerEffect/spacing)

The spacing specifies the distance between elements at which they begin to merge.

## Relationships

### Conforms To

[`NSCoding`](/documentation/Foundation/NSCoding)

[`CustomStringConvertible`](/documentation/Swift/CustomStringConvertible)

[`CVarArg`](/documentation/Swift/CVarArg)

[`NSObjectProtocol`](/documentation/ObjectiveC/NSObjectProtocol)

[`CustomDebugStringConvertible`](/documentation/Swift/CustomDebugStringConvertible)

[`SendableMetatype`](/documentation/Swift/SendableMetatype)

[`Hashable`](/documentation/Swift/Hashable)

[`Sendable`](/documentation/Swift/Sendable)

[`Equatable`](/documentation/Swift/Equatable)

[`NSCopying`](/documentation/Foundation/NSCopying)

[`NSSecureCoding`](/documentation/Foundation/NSSecureCoding)

### Inherits From

[`UIVisualEffect`](/documentation/UIKit/UIVisualEffect)

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)