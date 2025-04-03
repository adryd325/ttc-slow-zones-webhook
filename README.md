# TTC Slow Zones Webhook

![image](https://github.com/user-attachments/assets/68d4e18b-5fe4-47de-89ba-7b8eaf8cc577)

How does it work? Through really, _really_ bad code. <small>(see parseTable() in index.js for more information)</small>

Scrapes the TTC slow zones web page and looks for changes in the hash of the image or the table of subway slow zones. When it detects an update it will post to your webhooks!

I don't care about the streetcar slow zones since the streetcars are always slow, lol.

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
