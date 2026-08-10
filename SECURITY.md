# Security policy

## Scope

Lock Screen Connectivity Guard restricts the GNOME Shell connectivity user
interface while the unlock dialog or GDM login screen is active. It is designed
to prevent an unauthenticated person at the keyboard from using those Quick
Settings controls.

## Trust boundaries

- GNOME Shell UI hiding is not an operating-system authorization boundary.
- The optional NetworkManager PolicyKit rule is the authorization boundary for
  the listed NetworkManager actions.
- Bluetooth state protection remains a Shell-level safeguard. The project does
  not install a BlueZ policy broker or root Bluetooth watchdog.
- Root processes, hardware switches, kernel interfaces, and programs already
  running with the user's authority are outside the extension's boundary.

## Reporting a vulnerability

Do not include credentials, private logs, or personally identifiable data in a
public issue. Open a GitHub issue for non-sensitive security design questions.
For a vulnerability requiring private disclosure, contact the maintainer
through the private reporting mechanism on the repository's Security page when
it is available.

Include the affected version, GNOME Shell version, installation variant,
reproduction steps, and observed result.
