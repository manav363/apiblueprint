FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN chown -R node:node /app

USER node

CMD ["node", "server.js"]
