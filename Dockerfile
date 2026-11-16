FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build




FROM node:24-alpine

WORKDIR /app

RUN npm install -g dbmate

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db

RUN mkdir -p logs

EXPOSE 3007

CMD ["sh", "-c", "dbmate --no-dump-schema up && npm run start"]
