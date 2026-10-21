# El Ticketo — application web
# Build depuis la racine du dépôt : docker build -f FrontEnd/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY FrontEnd/package.json FrontEnd/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY FrontEnd/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY FrontEnd/nginx.conf /etc/nginx/conf.d/default.conf
COPY FrontEnd/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
