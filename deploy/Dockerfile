FROM node:20-alpine AS build
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci --ignore-scripts
COPY src/ .
# Bewusst KEINE API-Schlüssel einbauen (wären im Bundle öffentlich lesbar)
ENV VITE_GEMINI_API_KEY= VITE_REMOVE_BG_API_KEY=
RUN npx vite build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
