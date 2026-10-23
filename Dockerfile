FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3000 SIN_TUNEL=1 NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
