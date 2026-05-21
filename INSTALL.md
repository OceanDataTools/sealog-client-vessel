# sealog-client-vessel Installation

This document covers installing `sealog-client-vessel` as a standard Linux service or as a Docker container.

`sealog-client-vessel` requires a running [Sealog Server](https://github.com/OceanDataTools/sealog-server) instance.

---

## Standard Installation

Tested on Ubuntu 22.04 LTS and Ubuntu 24.04 LTS. Should work on RHEL 9 and Rocky 9 with minor adaptation.

### Prerequisites

- [Node.js](https://nodejs.org) >= 20.x (with npm, bundled)
- [git](https://git-scm.com)
- [nginx](https://nginx.org/)

#### Install Node.js via nvm (Ubuntu)

Run the nvm installer as the user that will own the Sealog service:

```bash
cd ~
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Load nvm and install the LTS release of Node.js:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm install --lts
```

#### Install nginx (Ubuntu)

```bash
sudo apt-get install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

### Clone the Repository

```bash
cd ~
git clone https://github.com/OceanDataTools/sealog-client-vessel.git sealog-client
```

### Create Configuration Files

Copy the distribution templates to create the working configuration files:

```bash
cd ~/sealog-client
cp src/client_settings.js.dist src/client_settings.js
cp src/map_tilelayers.js.dist src/map_tilelayers.js
cp webpack.config.js.dist webpack.config.js
```

### Configure the Client

Edit `src/client_settings.js` and set at minimum:

| Setting | Description |
|---------|-------------|
| `SERVER_HOSTNAME` | Hostname or IP of the Sealog Server (defaults to the browser's hostname) |
| `SERVER_PORT` | Port the Sealog Server listens on (default: `8000`) |
| `SERVER_TLS` | Set `true` if the server uses HTTPS/WSS |
| `ROOT_PATH` | URL path where this client is hosted (default: `'/'`; change if hosting at a sub-path e.g. `'/sealog/'`) |
| `USE_ACCESS_CONTROL` | Must match the `useAccessControl` setting on the Sealog Server |

Other commonly customised settings:

| Setting | Description |
|---------|-------------|
| `POSITION_DATASOURCES` | Aux data sources used as vessel position |
| `IMAGES_AUX_DATA_SOURCES` | Aux data sources rendered as imagery in the UI |
| `EXCLUDE_AUX_DATA_SOURCES` | Aux data sources to hide from the event display |
| `AUX_DATA_SORT_ORDER` | Display order for aux data cards |
| `CUSTOM_CRUISE_NAME` | Rename "cruise" to suit your programme |
| `DISABLE_EVENT_LOGGING` | Set `true` for read-only review instances |
| `RECAPTCHA_SITE_KEY` | Enable reCaptcha on login/registration |

Edit `src/map_tilelayers.js` to add or configure the tile layer sources shown in the map views.

### Move to Production Location

```bash
sudo mv ~/sealog-client /opt/sealog-client
```

### Install Dependencies

```bash
cd /opt/sealog-client
npm install
```

### Build

```bash
cd /opt/sealog-client
npm run build
```

This produces the compiled client in `/opt/sealog-client/dist`.

---

### Configure nginx

Create a site configuration file:

```bash
sudo nano /etc/nginx/sites-available/sealog
```

Paste the following (adjust `server_name` and `root` if needed):

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name _;

    root /opt/sealog-client/dist;
    index index.html;

    location / {
        include /etc/nginx/mime.types;
        try_files $uri $uri/ /index.html;
    }
}
```

> **Note:** `try_files $uri $uri/ /index.html` is required for client-side routing. Using `=404` instead will cause page-not-found errors when navigating directly to any URL other than `/`.

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/sealog /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```

---

### Hosting at a Sub-path

If the client is not at the webserver root (e.g. `https://myserver/sealog/`):

1. Set `ROOT_PATH = '/sealog/'` in `src/client_settings.js`
2. Rebuild: `npm run build`
3. Update the nginx `location` block to match:

```nginx
location /sealog/ {
    include /etc/nginx/mime.types;
    try_files $uri $uri/ /sealog/index.html;
}
```

---

## Docker Deployment

Docker is the quickest way to get a production build running.

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin

### Setup

Copy the distribution templates:

```bash
cp Dockerfile.dist Dockerfile
cp docker-compose.yml.dist docker-compose.yml
cp nginx/nginx.conf.dist nginx/nginx.conf
```

The default `docker-compose.yml` exposes the client on port **8081**. Edit `docker-compose.yml` to change the host port if needed.

The Docker build uses the `.dist` settings files directly. If you need to customise settings (server hostname, port, etc.), either:
- Edit the `.dist` files before building, or
- Copy them, edit the copies, and update the `Dockerfile` `COPY` lines to point at your edited files.

### Build and Run

```bash
docker compose build
docker compose up -d
```

The client will be available at `http://<host>:8081/sealog/`.

### Updating

```bash
git pull
docker compose build
docker compose up -d
```

---

## Updating a Standard Installation

```bash
cd /opt/sealog-client
git pull
npm install
npm run build
sudo systemctl reload nginx
```

> After pulling, check `src/client_settings.js.dist` for any new settings that may need to be added to your `src/client_settings.js`.
