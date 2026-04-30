FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN chown -R node:node /app

USER node

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
