FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
