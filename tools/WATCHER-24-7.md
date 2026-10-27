# Keep the Bakong watcher online 24/7

Only needed if Admin → Settings → **Test Bakong connection** says "Direct check from the website" is ✗ (Bakong blocks servers outside Cambodia).
The watcher must run on ANY computer inside Cambodia that stays on and online all day. It needs only Node.js 20+ and the project folder with `.env.local` (no open ports, no tunnel).

## A. Cambodian VPS / mini server / Raspberry Pi (Linux) - best
```bash
cd /path/to/project
sudo cp tools/bakong-watcher.service /etc/systemd/system/
sudo nano /etc/systemd/system/bakong-watcher.service   # fix User= and the two paths
sudo systemctl enable --now bakong-watcher
journalctl -u bakong-watcher -f                          # live log: "Bakong connection: OK", "PAID CT-..."
```
It restarts by itself after a crash or a reboot.

## B. Old Android phone left on charge (Termux)
Install Termux, then: `pkg install nodejs git`, copy the project folder (with `.env.local`) to the phone, and run `termux-wake-lock && node tools/bakong-watcher.mjs`. Connect it to home Wi-Fi in Cambodia and disable battery optimisation for Termux.

## C. Windows PC
Double-click `start-bakong-watcher.bat`. To start it whenever the PC boots: press Win+R, type `shell:startup`, and put a shortcut to `start-bakong-watcher.bat` in that folder. In Windows power settings set Sleep to "Never".

## Check it works
Admin → Settings → Test Bakong connection → "Shop-PC watcher: running (last contact a few seconds ago)".
