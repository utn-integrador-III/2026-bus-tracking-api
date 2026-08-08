FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY . .

USER node

EXPOSE 8000

CMD ["node", "index.js"]
