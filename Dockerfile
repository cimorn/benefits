FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS dependencies
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/cimorn/benefits"
COPY --from=dependencies --chown=node:node /build/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json server.cjs ./
COPY --chown=node:node server ./server
COPY --chown=node:node index.html styles.css data.js inventory-app.js model.js inventory.js cloud.js favicon.svg ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.cjs"]
