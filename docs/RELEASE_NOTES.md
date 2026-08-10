# Lock Screen Connectivity Guard 1.0.0

## Highlights

- Hides Wi-Fi, Bluetooth, and Airplane Mode Quick Settings tiles while locked.
- Supports the GDM login screen through the system-installed release variant.
- Preserves the top-bar Wi-Fi and Bluetooth connection indicators.
- Restores hidden tiles after authentication or extension disablement.
- Attempts to preserve protected Airplane Mode and Bluetooth states.
- Includes optional NetworkManager PolicyKit hardening examples.

## Compatibility

Version 1.0.0 supports GNOME Shell 50 and was tested on Ubuntu 26.04 LTS with
GNOME Shell 50.1.

## Security note

The extension restricts GNOME Shell UI actions. It is not a system-wide
Bluetooth or RFKill authorization boundary. The optional PolicyKit rule adds a
separate authorization layer for selected NetworkManager actions.

## Installation

Use the `lock-screen-connectivity-guard-v1.0.0-system.zip` release asset for
system-wide and GDM installation. Follow the installation and migration steps
in the repository README.
