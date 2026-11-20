# Stage 1: Build TazaTokri React PWA
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENABLE_MSW=false
RUN npm run build

# Stage 2: Serve static assets via Nginx with SPA fallback, API proxy & security headers
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  server_tokens off;\n\
  client_max_body_size 10m;\n\
  add_header X-Content-Type-Options "nosniff" always;\n\
  add_header X-Frame-Options "DENY" always;\n\
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
  location = /nginx-health {\n\
    allow 127.0.0.1;\n\
    allow ::1;\n\
    deny all;\n\
    access_log off;\n\
    default_type text/plain;\n\
    return 200 "ok\\n";\n\
  }\n\
  location /api/ {\n\
    proxy_pass http://backend:8080;\n\
    proxy_http_version 1.1;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    proxy_set_header X-Forwarded-Proto $scheme;\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
