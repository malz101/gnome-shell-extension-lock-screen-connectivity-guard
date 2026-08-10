# extensions.gnome.org preparation

No extensions.gnome.org package is produced in Version 1.0.0. Submission is
deferred until the documented difference between runtime `gdm` support and the
current review metadata rules is clarified.

## Proposed listing description

> Hide Wi-Fi, Bluetooth, and Airplane Mode controls on the lock screen while
> preserving connection-status indicators.

The listing must not claim GDM support unless the submitted package and review
policy permit it.

## Unlock-dialog reviewer justification

The extension's sole purpose requires it to continue running while the screen
is locked so it can hide connectivity mutation controls. It does not connect
keyboard-event signals. Its `disable()` implementation releases every
visibility override, disconnects signals, removes main-loop sources, and
restores the affected controls.

## Screenshots to capture

1. Unlocked Quick Settings with Wi-Fi and Bluetooth controls visible.
2. Locked Quick Settings with those connectivity tiles absent.
3. Locked top bar showing the preserved connection-status indicators.
4. GDM Quick Settings using the system release variant.

Do not include usernames, notifications, SSIDs, Bluetooth device names, email
addresses, or other private information in screenshots.

## Deferred submission checklist

- Confirm the accepted `session-modes` values with GNOME reviewers.
- Generate an EGO-specific metadata file with only approved modes.
- Package with `gnome-extensions pack`.
- Inspect the ZIP root and exclude repository-only files.
- Run syntax, metadata, lifecycle, and Shexli checks.
- Capture privacy-safe screenshots.
- Upload through the extensions.gnome.org **Add yours** page.
- Respond accurately to reviewer questions, including questions about
  AI-assisted development and code comprehension.
