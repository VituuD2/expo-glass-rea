<!--
{
  "availability" : [
    "iOS: 8.0.0 -",
    "iPadOS: 8.0.0 -",
    "macCatalyst: 13.1.0 -",
    "tvOS: -",
    "visionOS: 1.0.0 -"
  ],
  "documentType" : "symbol",
  "framework" : "UIKit",
  "identifier" : "/documentation/UIKit/UIVisualEffectView",
  "metadataVersion" : "0.1.0",
  "role" : "Class",
  "symbol" : {
    "kind" : "Class",
    "modules" : [
      "UIKit"
    ],
    "preciseIdentifier" : "c:objc(cs)UIVisualEffectView"
  },
  "title" : "UIVisualEffectView"
}
-->

# UIVisualEffectView

An object that implements some complex visual effects.

```
@MainActor class UIVisualEffectView
```

## Overview

Depending on the desired effect, the effect may affect content layered behind the view or content added to the visual effect view’s [`contentView`](/documentation/UIKit/UIVisualEffectView/contentView). Apply a visual effect view to an existing view and then apply a [`UIBlurEffect`](/documentation/UIKit/UIBlurEffect) or [`UIVibrancyEffect`](/documentation/UIKit/UIVibrancyEffect) object to apply a blur or vibrancy effect to the existing view. After you add the visual effect view to the view hierarchy, add any subviews to the [`contentView`](/documentation/UIKit/UIVisualEffectView/contentView) property of the visual effect view. Don’t add subviews directly to the visual effect view itself.

### Set the correct alpha value

When using the [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) class, avoid alpha values that are less than 1. Creating views that are partially transparent causes the system to combine the view and all the associated subviews during an offscreen render pass. [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) objects need to be combined as part of the content they’re layered on top of in order to look correct. Setting the alpha to less than 1 on the visual effect view or any of its superviews causes many effects to look incorrect or not show up at all.

### Use masks with a visual effect view

Masks directly applied to a [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) are forwarded to the internal views that provide the visual effect, including the [`contentView`](/documentation/UIKit/UIVisualEffectView/contentView) itself. You can also apply masks directly to the [`contentView`](/documentation/UIKit/UIVisualEffectView/contentView). Applying a mask to a superview of a [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) object causes the effect to fail, and an exception is thrown.

Any mask provided to [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) isn’t the view that actually performs the mask. UIKit makes a copy of the view and applies it to each subview. To reflect a size change to the mask, you must apply the change to the original mask and reset it on the effect view.

### Capture a snapshot of a visual effect view

Many effects require support from the window that hosts the [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView). Attempting to take a snapshot of only the [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView) results in a snapshot that doesn’t contain the effect. To take a snapshot of a view hierarchy that contains a [`UIVisualEffectView`](/documentation/UIKit/UIVisualEffectView), you must take a snapshot of the entire [`UIWindow`](/documentation/UIKit/UIWindow) or [`UIScreen`](/documentation/UIKit/UIScreen) that contains it.

## Topics

### Creating a visual effect view

[`init(effect: UIVisualEffect?)`](/documentation/UIKit/UIVisualEffectView/init(effect:))

Creates a new visual effect view with the designated visual effect.

[`init?(coder: NSCoder)`](/documentation/UIKit/UIVisualEffectView/init(coder:))

Creates a visual effect view from data in an unarchiver.

### Retrieving view information

[`var contentView: UIView`](/documentation/UIKit/UIVisualEffectView/contentView)

A view object that can have a visual effect view added to it.

[`var effect: UIVisualEffect?`](/documentation/UIKit/UIVisualEffectView/effect)

The visual effect provided by the view.

## Relationships

### Conforms To

[`CALayerDelegate`](/documentation/QuartzCore/CALayerDelegate)

[`UIResponderStandardEditActions`](/documentation/UIKit/UIResponderStandardEditActions)

[`CLBodyIdentifiable`](/documentation/CoreLocation/CLBodyIdentifiable)

[`NSCoding`](/documentation/Foundation/NSCoding)

[`UIPopoverPresentationControllerSourceItem`](/documentation/UIKit/UIPopoverPresentationControllerSourceItem)

[`UIFocusEnvironment`](/documentation/UIKit/UIFocusEnvironment)

[`Equatable`](/documentation/Swift/Equatable)

[`UILargeContentViewerItem`](/documentation/UIKit/UILargeContentViewerItem)

[`CustomDebugStringConvertible`](/documentation/Swift/CustomDebugStringConvertible)

[`UITraitChangeObservable-67e94`](/documentation/UIKit/UITraitChangeObservable-67e94)

[`UIFocusItem`](/documentation/UIKit/UIFocusItem)

[`UIActivityItemsConfigurationProviding`](/documentation/UIKit/UIActivityItemsConfigurationProviding)

[`Hashable`](/documentation/Swift/Hashable)

[`NSTouchBarProvider`](/documentation/AppKit/NSTouchBarProvider)

[`CVarArg`](/documentation/Swift/CVarArg)

[`UIAppearance`](/documentation/UIKit/UIAppearance)

[`UICoordinateSpace`](/documentation/UIKit/UICoordinateSpace)

[`UITraitEnvironment`](/documentation/UIKit/UITraitEnvironment)

[`NSObjectProtocol`](/documentation/ObjectiveC/NSObjectProtocol)

[`Sendable`](/documentation/Swift/Sendable)

[`UIFocusItemContainer`](/documentation/UIKit/UIFocusItemContainer)

[`NSSecureCoding`](/documentation/Foundation/NSSecureCoding)

[`UIDynamicItem`](/documentation/UIKit/UIDynamicItem)

[`UIPasteConfigurationSupporting`](/documentation/UIKit/UIPasteConfigurationSupporting)

[`CMBodyIdentifiable`](/documentation/CoreMotion/CMBodyIdentifiable)

[`UIUserActivityRestoring`](/documentation/UIKit/UIUserActivityRestoring)

[`UIAppearanceContainer`](/documentation/UIKit/UIAppearanceContainer)

[`CustomStringConvertible`](/documentation/Swift/CustomStringConvertible)

[`UIAccessibilityIdentification`](/documentation/UIKit/UIAccessibilityIdentification)

[`SendableMetatype`](/documentation/Swift/SendableMetatype)

### Inherits From

[`UIView`](/documentation/UIKit/UIView)

---

Copyright &copy; 2026 Apple Inc. All rights reserved. | [Terms of Use](https://www.apple.com/legal/internet-services/terms/site.html) | [Privacy Policy](https://www.apple.com/privacy/privacy-policy)