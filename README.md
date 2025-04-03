# TTC Slow Zones Webhook

![image](https://github.com/user-attachments/assets/68d4e18b-5fe4-47de-89ba-7b8eaf8cc577)

How does it work? Through really, _really_ bad code. <small>(see parseTable() for details)</small>

## Setup

1. Clone the repo

```sh
git clone https://github.com/adryd325/ttc-slow-zones-webhook
cd ttc-slow-zones-webhook
```

2. Install dependencies

```sh
npm install
```

3. Paste your webhooks

```sh
# Paste your webhooks in the editor :)
nano webhooks.txt
```

4. Deploy this abomination

```sh
# Make changes to working directory and users
nano ttc-slow-zones.service
sudo cp ttc-slow-zones.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ttc-slow-zones.service
```
