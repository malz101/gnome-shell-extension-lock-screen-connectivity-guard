# Lock Screen Connectivity Guard

Lock Screen Connectivity Guard is a GNOME Shell extension that hides the
Wi-Fi, Bluetooth, and Airplane Mode Quick Settings tiles while the screen is
locked or the GDM login screen is active. The top-bar connection indicators
remain visible, and the hidden tiles return after authentication.

The name uses *connectivity* because the protected controls include Wi-Fi,
Bluetooth, and the RFKill-based Airplane Mode control rather than networking
alone.

## Version 1 behavior

| Session | Quick Settings tiles | Top-bar indicators |
| --- | --- | --- |
| Authenticated and unlocked | Available normally | Available normally |
| Locked / unlock dialog | Wi-Fi, Bluetooth, and Airplane Mode hidden | Preserved |
| GDM login screen | Wi-Fi, Bluetooth, and Airplane Mode hidden | Preserved |

The extension also records the Airplane Mode and Bluetooth states when a
protected session begins and attempts to restore them if they change before
the session is unlocked.

## Compatibility

- Tested distribution: Ubuntu 26.04 LTS
- Tested GNOME Shell: 50.1
- Declared GNOME Shell support: 50
- Display server: Wayland

The implementation uses private GNOME Shell Quick Settings fields. Support is
therefore intentionally limited to GNOME Shell 50 until additional versions
are tested.

## Installation choices

The project supports two distribution variants:

1. **System variant:** supports the authenticated session, unlock dialog, and
   GDM. This is the `v1.0.0` GitHub release artifact.
2. **extensions.gnome.org variant:** will contain only the `user` and
   `unlock-dialog` session modes. It is intentionally not being submitted in
   Version 1 until the current GNOME documentation conflict around `gdm`
   review eligibility is resolved.

Choose one installation method. Do not install both user and system copies of
the same UUID.

The permanent extension UUID is:

```text
lock-screen-connectivity-guard@malz101.github.io
```

### System-wide installation with GDM support

Download the system ZIP from the GitHub release, then run:

```bash
UUID='lock-screen-connectivity-guard@malz101.github.io'
ZIP="$HOME/Downloads/lock-screen-connectivity-guard-v1.0.0-system.zip"

sudo install -d -m 0755 "/usr/share/gnome-shell/extensions/$UUID"
sudo unzip -o "$ZIP" -d "/usr/share/gnome-shell/extensions/$UUID"
sudo chown -R root:root "/usr/share/gnome-shell/extensions/$UUID"
```

Enable the extension for the logged-in user:

```bash
gnome-extensions enable \
  lock-screen-connectivity-guard@malz101.github.io
```

On Wayland, log out and back in before testing the authenticated session.

### Enable the extension for GDM

Back up an existing GDM dconf profile before changing it:

```bash
sudo install -d -m 0755 /etc/dconf/profile /etc/dconf/db/gdm.d

if [ -f /etc/dconf/profile/gdm ]; then
    sudo cp -a /etc/dconf/profile/gdm /etc/dconf/profile/gdm.before-lscg
fi
```

If `/etc/dconf/profile/gdm` does not exist, create it with:

```text
user-db:user
system-db:gdm
file-db:/usr/share/gdm/greeter-dconf-defaults
```

Create `/etc/dconf/db/gdm.d/90-lock-screen-connectivity-guard`:

```ini
[org/gnome/shell]
enabled-extensions=['lock-screen-connectivity-guard@malz101.github.io']
```

If GDM already has enabled extensions, preserve them in the same string array
instead of replacing them. Then rebuild the dconf databases:

```bash
sudo dconf update
```

Log out or reboot to start a fresh GDM Shell process. Restarting GDM directly
will terminate graphical sessions, so save all work first.

## Optional NetworkManager PolicyKit hardening

The GNOME extension hides Shell controls. The optional PolicyKit component
adds a stronger NetworkManager authorization boundary while GDM is active or
the user's session is locked.

Review the example files before installing them:

```bash
sudo install -d -m 0755 /usr/local/libexec
sudo install -m 0755 \
  examples/polkit/polkit-session-locked \
  /usr/local/libexec/polkit-session-locked

sudo install -m 0644 \
  examples/polkit/10-network-lockdown.rules \
  /etc/polkit-1/rules.d/10-network-lockdown.rules
```

PolicyKit normally reloads JavaScript rules automatically. If necessary:

```bash
sudo systemctl restart polkit.service
```

The PolicyKit examples are repository resources and are not included in the
GNOME extension ZIP.

## Verification

1. Lock the session with <kbd>Super</kbd>+<kbd>L</kbd>.
2. Open Quick Settings and confirm that Wi-Fi, Bluetooth, and Airplane Mode
   tiles are absent.
3. Confirm that active Wi-Fi and Bluetooth status icons remain in the top bar.
4. Unlock and confirm that the tiles return.
5. Log out and repeat the Quick Settings check on GDM.

Check for loading or JavaScript errors:

```bash
journalctl -b --no-pager |
grep -E \
  'lock-screen-connectivity-guard@malz101.github.io|Extension.*ERROR|JS ERROR'
```

Confirm the user-session state:

```bash
gnome-extensions info \
  lock-screen-connectivity-guard@malz101.github.io
```

## Troubleshooting

### Extension is not listed

Confirm that the installation directory exactly matches the UUID:

```text
/usr/share/gnome-shell/extensions/
└── lock-screen-connectivity-guard@malz101.github.io/
    ├── extension.js
    └── metadata.json
```

Then log out and back in so GNOME Shell rescans system extensions.

### GDM still shows the tiles

- Confirm that `metadata.json` contains `gdm` in `session-modes`.
- Run `sudo dconf update` again.
- Confirm that the GDM dconf string array contains the permanent UUID.
- Start a fresh GDM process by logging out or rebooting.

### Tiles remain hidden after unlock

Disable the extension and report the journal output:

```bash
gnome-extensions disable \
  lock-screen-connectivity-guard@malz101.github.io
```

Disabling the extension calls its cleanup path and restores the controls.

## Migration from the development UUID

Disable the previous development installation:

```bash
gnome-extensions disable lockscreen-network-guard@local 2>/dev/null || true
```

Remove the old UUID from the user's and GDM's `enabled-extensions` arrays.
After verifying the new extension, remove these old directories if present:

```bash
rm -rf "$HOME/.local/share/gnome-shell/extensions/lockscreen-network-guard@local"
sudo rm -rf \
  /usr/share/gnome-shell/extensions/lockscreen-network-guard@local
sudo dconf update
```

## Upgrade

Disable the extension, replace the files with the newer system release ZIP,
and then log out and back in:

```bash
UUID='lock-screen-connectivity-guard@malz101.github.io'
gnome-extensions disable "$UUID" 2>/dev/null || true
sudo unzip -o /path/to/new-system-release.zip \
  -d "/usr/share/gnome-shell/extensions/$UUID"
sudo chown -R root:root "/usr/share/gnome-shell/extensions/$UUID"
```

## Uninstallation and rollback

```bash
UUID='lock-screen-connectivity-guard@malz101.github.io'

gnome-extensions disable "$UUID" 2>/dev/null || true
sudo rm -rf "/usr/share/gnome-shell/extensions/$UUID"
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"

sudo rm -f /etc/dconf/db/gdm.d/90-lock-screen-connectivity-guard
sudo dconf update
```

If the optional PolicyKit hardening was installed from this repository:

```bash
sudo rm -f /etc/polkit-1/rules.d/10-network-lockdown.rules
sudo rm -f /usr/local/libexec/polkit-session-locked
sudo systemctl restart polkit.service
```

Restore `/etc/dconf/profile/gdm.before-lscg` if the installation created that
backup and the original profile is required. Log out or reboot afterward.

## Security model

| Component | What it protects | What it does not protect |
| --- | --- | --- |
| GNOME extension | GNOME Shell Quick Settings on lock/GDM screens | Direct D-Bus, BlueZ, RFKill, privileged processes, or malware already running in a session |
| NetworkManager PolicyKit rule | Selected NetworkManager mutations while locked and all matching GDM requests | Bluetooth/BlueZ, privileged root processes, hardware radio switches |
| Airplane/Bluetooth state restoration | Accidental state changes observed while protected | A complete authorization boundary |

This project reduces unauthenticated changes through the GNOME interface. It
does not claim to provide a complete system security boundary. See
[`SECURITY.md`](SECURITY.md) for the detailed threat model.

## Building

Repository validation and packaging commands are documented by `make help`.
The official package is generated with `gnome-extensions pack`; build scripts,
PolicyKit files, documentation sources, and GitHub metadata are excluded from
the extension ZIP.

## Contributing and reporting bugs

Open an issue with:

- Ubuntu and GNOME Shell versions
- Whether the problem occurs in the user session, unlock dialog, or GDM
- Extension installation type
- Relevant journal output
- Exact reproduction steps

Bug tracker:
<https://github.com/malz101/gnome-shell-extension-lock-screen-connectivity-guard/issues>

## License

Copyright © 2026 Malik Edwards.

Lock Screen Connectivity Guard is licensed under
[`GPL-2.0-or-later`](LICENSE).
